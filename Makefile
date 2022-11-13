# Runs a custom target on affected modules
# e.g: "make build" runs the "build" target on affected modules
# e.g: "make whatever" runs the "whatever" target on affected modules, if configured
# if you create a specific target, it will be preferred to this generic rule
%:
	yarn install
	npx nx affected --target=$@ --base=$$NX_BASE --head=$$NX_HEAD --verbose --output-style=stream

# Run build only on affected modules
build:
	yarn install
	npx nx affected --target=build-module --base=$$NX_BASE --head=$$NX_HEAD --verbose --output-style=stream

# Run build on all modules
build-all:
	yarn install
	npx nx run-many --target=build-module --verbose --output-style=stream

# Clean all temporary resources (useful to check how CI will behave)
clean:
	npx nx run-many --target=clean
	rm -rf node_modules

# run everything from scratch (similar to CI)
all: clean build lint unit-tests
