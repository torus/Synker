package synker::Storage;

sub new {
    my ($class, %init) = @_;
    my $obj = {};
    for my $k (keys %init) {
        $obj->{$k} = $init{$k};
    }

    if (ref $class) {
        bless $obj => ref $class;
    } else {
        bless $obj => $class;
    }
}

1;
