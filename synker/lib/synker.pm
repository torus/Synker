package synker;

use XML::LibXML;
use XML::LibXML::LazyMatcher;
use XML::LibXML::LazyBuilder;

use Data::Dumper;

use Dancer ':syntax';

our $VERSION = '0.1';

get '/' => sub {
    template 'index';
};

my $storage = {};
my $count = 0;
my $history = [];

get '/pull/:id' => sub {
    package XML::LibXML::LazyBuilder;

    # my $dom = DOM (E (state => {}, map {my $e = $_; sub {$e->setOwnerDocument ($_[0]); $e}} @{$storage}));

    # $dom->toString;

    Data::Dumper::Dumper ($storage)
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
			$obj->{$key} = bless $objref => "ObjectRef";
			1
		    }),
		 M (object_list =>
		    sub {
			my $objlist = bless [] => "ObjectList";
			$obj->{$key} = $objlist;
			1
		    },
		    C (M (object_ref =>
			  sub {
			      my $objid = $_[0]->getAttribute ("object_id");
			      my $objlist = $obj->{$key};
			      my $objref = bless {object_id => $objid} => "ObjectRef";
			      push @$objlist, $objref;
			      1
			  }),
		       synker::ignore_white_space)
		    ),
		 synker::ignore_white_space)),
	   synker::ignore_white_space)->($_[0])
    }
}

post '/push' => sub {
    my $up = params->{update};

    if ($up) {
	my $doc = XML::LibXML->load_xml (string => $up);
	# push @{$storage}, $doc->documentElement;

	package XML::LibXML::LazyMatcher;

	my @changes;

	my $m = M (updates =>
		   C (sub {
		       my $box = [];
		       M (update => sub {
			   my $objid = $_[0]->getAttribute ("object_id");
			   my $obj = $storage->{$objid};
			   if (!$obj) {
			       die "object not found."
			   }
			   my $pro = bless {} => "Properties";
			   $box->[0] = bless {object_id => $objid,
					      properties => $pro} => "UpdateObject";
			   1
			  },
			  synker::match_property ($box),
			  sub {
			      push @changes, $box->[0];
			      1
			  }
			   )}->(),
		      sub {
			  my $box = [];
			  M (new_object => sub {
			      my $objid = $_[0]->getAttribute ("object_id");
			      my $obj;
			      if ($storage->{$objid}) {
				  die "object " . $objid . " already exists.";
				  return 0;
			      }
			      my $pro = bless {} => "Properties";
			      $box->[0] = bless {object_id => $objid,
						 properties => $pro} => "NewObject";
			      1
			     },
			     synker::match_property ($box),
			     sub {
				 push @changes, $box->[0];
				 1
			     }
			      )}->(),
		      synker::ignore_white_space
		   ));
	my $valid = $m->($doc->documentElement);

	print "============valid = $valid\n";

	die "$count  $#$history" if $count != $#$history + 1;

	my $state_id = $count ++;
	push @$history, {state_id => $state_id, changes => \@changes};

	print Data::Dumper::Dumper (\@changes);

	package XML::LibXML::LazyBuilder;
	DOM (E response => {},
	     (E new_state => {state_id => $state_id}))->toString;
    }
};

true;
