# runs any target on all submodules
# e.g: "make test" runs the "test" target on all modules
# e.g: "make whatever" runs the "whatever" target on all modules
# if you create a specific target, it will be preferred to this generic rule
%:
	make $@ -C core
	make $@ -C middy

