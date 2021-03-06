package synker;

use Encode;

use XML::LibXML;
use XML::LibXML::LazyMatcher;
use XML::LibXML::LazyBuilder;

use Data::Dumper;
use synker::State;
use Dancer ':syntax';

our $VERSION = '0.1';

my $states = {};

sub get_state_obj {
    my ($key) = @_;
    my $stat = $states->{$key};
    if (!$stat) {
        $stat = load_changes ($key);
        $states->{$key} = $stat;
    }

    $stat
}

sub output_dom {
    Encode::decode("utf-8", $_[0]->toString);
}

get '/' => sub {
    template 'index';
};

get '/:key' => sub {
    header('Content-Type' => 'text/plain');
    my $key = params->{key};
    my $stat = get_state_obj ($key);
    my $storage = $stat->{storage};
    Data::Dumper::Dumper ($storage)
};

get '/history/:key/:id?' => sub {
    my $id = params->{id} || 0;
    my $key = params->{key};
    my $stat = get_state_obj ($key);
    my $history = $stat->{history};
    my $current = $#$history;

    my $dom;

    {
	package XML::LibXML::LazyBuilder;

	my @recents = @$history[$id .. $current];
	# print Data::Dumper::Dumper ({recents => \@recents});

	$dom = DOM (E (history => {begin_state_id => $id, last_state_id => $current},
		       map {my $e = $_;
			    $e->toLazyXMLElement
		       } @recents));
    }

    header('Content-Type' => 'text/xml');
    &output_dom ($dom);
};

get '/snapshot/:key' => sub {
    my $key = params->{key};
    my $stat = get_state_obj ($key);
    my $history = $stat->{history};
    my $storage = $stat->{storage};
    my $current = $#$history;

    my $dom;

    {
	package XML::LibXML::LazyBuilder;

	$dom = DOM (E (snapshot => {state_id => $current},
		       map {my $e = $storage->{$_};
			    $e->toLazyXMLElement
		       } keys %$storage));
    }

    header('Content-Type' => 'text/xml');
    &output_dom ($dom);
};

sub ignore_white_space {
    sub {
	1 if ($_[0]->nodeType == XML::LibXML::XML_TEXT_NODE
	      && $_[0]->textContent =~ /[\s\n]*/m);
    }
}

sub match_property {
    my $box = shift;
    sub {
	my $obj = $box->[0]->{properties};
	package XML::LibXML::LazyMatcher;

	my $key;
	C (M (property =>
	      sub {$key = $_[0]->getAttribute ("key"); 1},
	      C (sub {
		  if ($_[0]->nodeType == XML::LibXML::XML_TEXT_NODE
		      && $_[0]->textContent !~ /^[\s\n]*$/m) {
		      $obj->{$key} = $_[0]->textContent ();
		      1
		  }
		 },
		 M (object_ref =>
		    sub {
			my $objid = $_[0]->getAttribute ("object_id");
			my $objref = {object_id => $objid};
			$obj->{$key} = bless $objref => "synker::ObjectRef";
			1
		    }),
		 M (object_list =>
		    sub {
			my $objlist = bless [] => "synker::ObjectList";
			$obj->{$key} = $objlist;
			1
		    },
		    C (M (object_ref =>
			  sub {
			      my $objid = $_[0]->getAttribute ("object_id");
			      my $objlist = $obj->{$key};
			      my $objref = bless {object_id => $objid} =>
				  "synker::ObjectRef";
			      push @$objlist, $objref;
			      1
			  }),
		       synker::ignore_white_space)
		    ),
		 synker::ignore_white_space)),
	   synker::ignore_white_space)->($_[0])
    }
}

sub apply_changes {
    my ($storage, $changes) = @_;

    for my $i (@$changes) {
	$i->apply_to ($storage);
    }
}

sub handle_update_object {
    my ($box, $stat) = @_;
    my $storage = $stat->{storage};

    (sub {
	my $objid = $_[0]->getAttribute ("object_id");
	my $obj = $storage->{$objid};
	if (!$obj) {
	    die "object not found: objid = $objid"
	}
	my $pro = bless {} => "synker::Properties";
	$box->[0] = bless {object_id => $objid,
			   properties => $pro} => "synker::UpdateObject";
	1
    },
     synker::match_property ($box)
    )
}

sub handle_delete_object {
    my ($box, $stat) = @_;
    my $storage = $stat->{storage};

    sub {
	my $objid = $_[0]->getAttribute ("object_id");
	my $obj = $storage->{$objid};
	if (!$obj) {
	    die "object not found."
	}
	$box->[0] = bless {object_id => $objid} => "synker::DeleteObject";
	1
    }
}

sub handle_new_object {
    my ($box, $stat) = @_;
    my $storage = $stat->{storage};

    (sub {
	my $objid = $_[0]->getAttribute ("object_id");
	my $obj;
	if ($storage->{$objid}) {
	    die "object " . $objid . " already exists.";
	    return 0;
	}
	my $pro = bless {} => "synker::Properties";
	$box->[0] = bless {object_id => $objid,
			   properties => $pro} => "synker::NewObject";
	1
     },
     synker::match_property ($box)
    )
}

sub read_updates {
    my ($doc, $stat) = @_;

    package XML::LibXML::LazyMatcher;

    my @changes;
    my $state_id;

    my $m = M (updates =>
	       sub {$state_id = $_[0]->getAttribute ("state_id"); 1},
	       C (sub {
		   my $box = [];
		   M (update_object =>
		      synker::handle_update_object ($box, $stat),
		      sub {push @changes, $box->[0]; 1}
		       )}->(),
		  sub {
		      my $box = [];
		      M (new_object =>
			 synker::handle_new_object ($box, $stat),
			 sub {push @changes, $box->[0]; 1}
			  )}->(),
		  sub {
		      my $box = [];
		      M (delete_object =>
			 synker::handle_delete_object ($box, $stat),
			 sub {push @changes, $box->[0]; 1}
			  )}->(),
		  synker::ignore_white_space
	       ));
    my $valid = $m->($doc->documentElement) or die "invalid update";

    ($state_id, @changes)
}

sub store_changes {
    my ($key, $updates) = @_;

    debug $key;

    # TODO: Factory
    use synker::Storage::File;

    my $st = new synker::Storage::File file => "$key.xml";
    $st->store_changes ($updates);
}

sub load_changes {
    my ($key) = @_;

    # TODO: Factory
    use synker::Storage::File;

    my ($history, $storage, $count) = ([], {}, 0);

    my $stat = synker::State->new (history => $history, storage => $storage,
                                   count => $count);

    my $st = new synker::Storage::File file => "$key.xml";
    $st->load_changes ($stat);

    debug join ", ", $count, $key, $storage;

    return $stat;
}

post '/push' => sub {
    my $up = params->{update};
    my $key = params->{key};
    die "no key given" unless $key;
    my $stat = get_state_obj ($key);

    debug $stat;

    if ($up) {
	my $doc = XML::LibXML->load_xml (string => $up);
	my ($state_id, @changes) = eval {read_updates ($doc, $stat)};

	die "$stat->{count}  $#{$stat->{history}}"
            if $stat->{count} != $#{$stat->{history}} + 1;

	$state_id ||= $stat->{count} ++;
	my $updates = bless {state_id => $state_id,
			     changes => \@changes} => "synker::Updates";
	push @{$stat->{history}}, $updates;

	store_changes ($key, $updates);
	apply_changes ($stat->{storage}, \@changes);

	package XML::LibXML::LazyBuilder;
	&synker::output_dom (DOM (E response => {},
                            (E new_state => {state_id => $state_id})));
    }
};

package synker::NewObject;

sub apply_to {
    my ($self, $storage) = @_;

    if ($storage->{$self->{object_id}}) {
	die "$self->{object_id}: already exists";
    } else {
	my %prop = %{$self->{properties}};
	# print Data::Dumper::Dumper (\%prop);
	my $obj = bless {object_id => $self->{object_id},
			 properties => bless \%prop
			     => "synker::Properties"} => "synker::Object";
	$storage->{$self->{object_id}} = $obj;
    }
}

sub toLazyXMLElement {
    my $self = shift;

    package XML::LibXML::LazyBuilder;
    E (new_object => {object_id => $self->{object_id}},
       $self->{properties}->toLazyXMLElement)
}

package synker::UpdateObject;

sub apply_to {
    my ($self, $storage) = @_;

    if (! $storage->{$self->{object_id}}) {
	die "$self->{object_id}: doesn't exists";
    } else {
	my $obj = $storage->{$self->{object_id}};
	for my $key (keys %{$self->{properties}}) {
	    $obj->{properties}->{$key} = $self->{properties}->{$key};
	}
    }
}

sub toLazyXMLElement {
    my $self = shift;

    package XML::LibXML::LazyBuilder;
    E (update_object => {object_id => $self->{object_id}},
       $self->{properties}->toLazyXMLElement)
}

package synker::DeleteObject;

sub apply_to {
    my ($self, $storage) = @_;

    if (! $storage->{$self->{object_id}}) {
	die "$self->{object_id}: doesn't exists";
    } else {
	delete $storage->{$self->{object_id}};
    }
}

sub toLazyXMLElement {
    my $self = shift;

    package XML::LibXML::LazyBuilder;
    E (delete_object => {object_id => $self->{object_id}})
}

package synker::Object;

sub toLazyXMLElement {
    my $self = shift;

    package XML::LibXML::LazyBuilder;
    E (object => {object_id => $self->{object_id}},
       $self->{properties}->toLazyXMLElement)
}

package synker::Properties;

sub toLazyXMLElement {
    my $self = shift;

    package XML::LibXML::LazyBuilder;

    map {
	my $key = $_;
	E (property => {key => $key},
	   sub {
	       my $val = shift;
	       ref $val ? $val->toLazyXMLElement : $val;
	   }->($self->{$key}))
    } keys %$self;
}

package synker::ObjectList;

sub toLazyXMLElement {
    my $self = shift;

    package XML::LibXML::LazyBuilder;

    E (object_list => {},
       map {
	   my $val = $_;
	   ref $val ? $val->toLazyXMLElement : $val;
       } @$self)
}

package synker::ObjectRef;

sub toLazyXMLElement {
    my $self = shift;

    package XML::LibXML::LazyBuilder;

    E (object_ref => {object_id => $self->{object_id}})
}

package synker::Updates;

sub toLazyXMLElement {
    my $self = shift;

    package XML::LibXML::LazyBuilder;

    E (updates => {state_id => $self->{state_id}},
       map {
	   my $val = $_;
	   ref $val ? $val->toLazyXMLElement : $val;
       } @{$self->{changes}})
}

package synker;

true;
