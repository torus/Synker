test-all: test-newobj test-newobj2 test-update

test-newobj:
	curl -F 'key=hogetest' -F 'update=<test.xml' http://localhost:5000/push

test-newobj2:
	curl -F 'key=hogetest' -F 'update=<test_2.xml' http://localhost:5000/push

test-update:
	curl -F 'key=hogetest' -F 'update=<test_3.xml' http://localhost:5000/push
