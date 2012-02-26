package synker::State;
use Moose;

has 'storage' => (isa => 'HashRef', is => 'rw', required => 1);
has 'count' => (isa => 'Int', is => 'rw', required => 1);
has 'history' => (isa => 'ArrayRef', is => 'rw', required => 1);

1;
