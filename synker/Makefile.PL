use strict;
use warnings;
use ExtUtils::MakeMaker;

WriteMakefile(
    NAME                => 'synker',
    AUTHOR              => q{Toru Hisai <toru@torus.jp>},
    VERSION_FROM        => 'lib/synker.pm',
    ABSTRACT            => 'Synchronizer',
    ($ExtUtils::MakeMaker::VERSION >= 6.3002
      ? ('LICENSE'=> 'perl')
      : ()),
    PL_FILES            => {},
    PREREQ_PM => {
        'Test::More' => 0,
        'YAML'       => 0,
        'Dancer'     => 1.3051,
	'Plack'      => 0.9974,
	'XML::LibXML' => 0,
	'XML::LibXML::LazyMatcher' => 0,
	'XML::LibXML::LazyBuilder' => 0,
	'URI'        => 1.59,
	'Data::UUID' => 1.217,
        'Moose'      => 2.0402,
    },
    NORECURS            => 0,
    dist                => { COMPRESS => 'gzip -9f', SUFFIX => 'gz', },
    clean               => { FILES => 'synker-*' },
);
