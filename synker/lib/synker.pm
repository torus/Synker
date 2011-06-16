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

get '/pull/:id' => sub {
    package XML::LibXML::LazyBuilder;

    # my $dom = DOM (E (state => {}, map {my $e = $_; sub {$e->setOwnerDocument ($_[0]); $e}} @{$storage}));

    # $dom->toString;

    Data::Dumper::Dumper ($storage)
};

sub match_property {
    my $box = shift;
    sub {
	my $obj = $box->[0];
	package XML::LibXML::LazyMatcher;
	print "match_property $obj\n";

	C (M (property => sub {
	    my $key = $_[0]->getAttribute ("key");
	    my @values = $_[0]->childNodes ();

	    print "\n\n", $obj, $key, @values, "\n";

	    $obj->{$key} = \@values;
	    1}),
	   sub {1})->(@_)
    }
}

post '/push' => sub {
    my $up = params->{update};

    if ($up) {
	my $doc = XML::LibXML->load_xml (string => $up);
	# push @{$storage}, $doc->documentElement;

	package XML::LibXML::LazyMatcher;

	my $m = M (updates =>
		   C (sub {
		       my $box = [];
		       M (update => sub {
			   my $objid = $_[0]->getAttribute ("object_id");
			   print "\n=========update $objid\n";
			   my $obj = $storage->{$objid};
			   if (!$obj) {
			       die "object not found."
			   }
			   $box->[0] = $obj;
			   print "obj = $obj\n";
			   1
			  },
			  synker::match_property ($box),
			   )}->(),
		      sub {
			  my $box = [];
			  M (new_object => sub {
			      my $objid = $_[0]->getAttribute ("object_id");
			      my $obj;
			      print "\n=========new_object $objid\n";
			      if ($storage->{$objid}) {
				  die "object " . $objid . " already exists.";
				  return 0;
			      } else {
				  $obj = {}; # new object
				  $storage->{$objid} = $obj;
			      }
			      $box->[0] = $obj;
			      print "obj = $obj\n";
			      1
			     },
			     synker::match_property ($box)
			      )}->(),
		      sub {1}
		   ));
	my $valid = $m->($doc->documentElement);
	print "============valid = $valid\n";
	"done"
    }
};

true;
