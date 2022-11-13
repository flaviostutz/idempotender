# runs a target on affected modules
# e.g: "make test" runs the "test" target on affected modules
# e.g: "make whatever" runs the "whatever" target on affected modules
# if you create a specific target, it will be preferred to this generic rule
%:
	yarn install
	rm -rf /tmp/dynamodb-local
	npx nx affected --target=$@ --base=$$NX_BASE --head=$$NX_HEAD --verbose --output-style=stream

build:
	yarn install
	npx nx affected --target=build-module --base=$$NX_BASE --head=$$NX_HEAD --verbose --output-style=stream

build-all:
	yarn install
	npx nx run-many --target=build-module --verbose --output-style=stream

clean:
	npx nx run-many --target=clean
	rm -rf node_modules

