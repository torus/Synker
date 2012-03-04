package synker::Storage::File;
use parent qw (synker::Storage);

sub new {
    my $obj = synker::Storage::new (@_);
    die unless $obj->{file};

    $obj;
}

sub store_changes {
    my ($self, $updates) = @_;

    my $serialized = XML::LibXML::LazyBuilder::DOM ($updates->toLazyXMLElement)->toString;

    use Dancer::FileUtils 'open_file';
    my $out = open_file('>>', $self->{file}) or die;
    binmode $out, ":raw";
    print $out $serialized;
    print $out "\n<!-- @{[scalar localtime]} -->\n\0"; # \0 for delimiter

    $out->close;
}

sub load_changes {
    my ($self, $stat) = @_;
    my ($history, $storage, $count_ref) = ($stat->{history}, $stat->{storage}, \$stat->{count});

    use Dancer::FileUtils 'open_file';
    my $out = eval {open_file('<', $self->{file})};

    if (defined $out) {
	local $/ = "\0";
	while (my $xml = <$out>) {
            chomp $xml;
	    my $doc = XML::LibXML->load_xml (string => $xml);
	    my ($state_id, @changes) = eval {synker::read_updates ($doc, $stat)};
            if ($@) {
                warn "$!: $@";
            }

	    $$count_ref = $state_id + 1;
	    my $updates = bless {state_id => $state_id,
				 changes => \@changes} => "synker::Updates";
	    push @$history, $updates;

	    synker::apply_changes ($storage, \@changes);
	}
    }
}

1;
