package synker::Storage::File;

sub new {
    my ($class, %init) = @_;
    my $obj = {};
    for my $k (keys %init) {
        $obj->{$k} = $init{$k};
    }

    die unless $obj->{file};

    if (ref $class) {
        bless $obj => ref $class;
    } else {
        bless $obj => $class;
    }
}

sub store_changes {
    my ($self, $updates) = @_;

    my $serialized = XML::LibXML::LazyBuilder::DOM ($updates->toLazyXMLElement)->toString;

    use Dancer::FileUtils 'open_file';
    my $out = open_file('>>', $self->{file}) or die;
    print $out $serialized;
    print $out "\n<!-- @{[scalar localtime]} -->\n\0"; # \0 for delimiter

    $out->close;
}

1;
