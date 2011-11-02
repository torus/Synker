package synker::Storage::File;

sub new {
    my $class = shift;

    if (ref $class) {
        bless {} => ref $class;
    } else {
        bless {} => __PACKAGE__;
    }
}

sub store_changes {
    my ($self, $updates) = @_;

    my $serialized = XML::LibXML::LazyBuilder::DOM ($updates->toLazyXMLElement)->toString;

    use Dancer::FileUtils 'open_file';
    my $out = open_file('>>', "hoge.xml") or die;
    print $out $serialized;
    print $out "\n<!-- @{[scalar localtime]} -->\n\0"; # \0 for delimiter

    $out->close;
}

1;
