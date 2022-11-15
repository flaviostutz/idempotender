# Build this module and all its dependencies
build: install
	# NX will trigger build of all modules this module depends on
	npx nx run build-module --verbose --output-style=stream

# Build only this module (without dependencies)
build-module: install
	rm -rf dist
	npx esbuild src/index.ts --bundle --platform=node --outfile=dist/index.js
	npx tsc --emitDeclarationOnly --outDir dist

lint:
	npx prettier --loglevel warn --write .
	npx eslint . --ext .ts --fix
	npx tsc -noEmit --skipLibCheck
	yarn audit; [[ $? -ge 8 ]] && exit 1 || exit 0

test: unit-tests

unit-tests:
	npx jest --verbose

publish:
	git config --global user.email "flaviostutz@gmail.com"
	git config --global user.name "Flávio Stutz"
	npm version from-git --no-git-tag-version
	echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc
	yarn publish

all: build lint test

clean:
	rm -rf node_modules
	rm -rf dist

install: node_modules
	yarn install --frozen-lockfile --ignore-optional
