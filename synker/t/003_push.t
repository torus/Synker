use Test::More tests => 3;
use strict;
use warnings;

use URI::Escape;
use Data::UUID;

# the order is important
use synker;
use Dancer::Test;

my $ug = new Data::UUID;
my $uuid = $ug->create ();
my $objid1 = $ug->to_string ($uuid);

my $new_obj_xml = uri_escape (<<END_OF_XML);
<updates>
  <new_object object_id="$objid1">
    <property key="x">123</property>
    <property key="y">456</property>
  </new_object>
</updates>
END_OF_XML

my $res = dancer_response POST => '/push', {body => "update=$new_obj_xml"};
is $res->{status}, 200, "push new object data";

my $uuid2 = $ug->create ();
my $objid2 = $ug->to_string ($uuid2);

my $uuid3 = $ug->create ();
my $objid3 = $ug->to_string ($uuid3);

my $new_obj2_xml = uri_escape (<<END_OF_XML2);
<updates>
  <new_object object_id="$objid2">
    <property key="n">xyz</property>
  </new_object>
  <new_object object_id="$objid3">
    <property key="a"><object_ref object_id="$objid1"/></property>
    <property key="b">
      <object_list>
	<object_ref object_id="$objid1"/>
	<object_ref object_id="$objid2"/>
      </object_list>
    </property>
  </new_object>
</updates>
END_OF_XML2

my $res2 = dancer_response POST => '/push', {body => "update=$new_obj2_xml"};
is $res2->{status}, 200, "push new object refering previous object";


my $update_obj_xml = uri_escape (<<END_OF_XML3);
<updates>
  <update_object object_id="$objid1">
    <property key="x">12345</property>
    <property key="z">987</property>
  </update_object>
</updates>
END_OF_XML3

my $res3 = dancer_response POST => '/push', {body => "update=$update_obj_xml"};
is $res3->{status}, 200, "update object property";
