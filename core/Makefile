build:
	yarn install --frozen-lockfile
	rm -rf dist
	yarn exec esbuild src/index.ts --bundle --platform=node --outfile=dist/index.js
	yarn exec tsc --emitDeclarationOnly --outDir dist

lint:
	npx prettier --loglevel warn --write .
	npx eslint . --ext .ts --fix
	npx tsc -noEmit --skipLibCheck
	yarn audit; [[ $? -ge 8 ]] && exit 1 || exit 0

test: unit-tests

unit-tests:
	yarn test

publish:
	git config --global user.email "flaviostutz@gmail.com"
	git config --global user.name "Flávio Stutz"
	npm version from-git
	npm publish

all: build lint test

