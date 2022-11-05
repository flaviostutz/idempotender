build:
	npm ci
	npm run build

lint:
	npx prettier --loglevel warn --write .
	npx eslint . --ext .ts --fix
	npx tsc -noEmit --skipLibCheck
	npm audit --audit-level high

test: unit-tests

unit-tests:
	npm run test

publish:
	git config --global user.email "flaviostutz@gmail.com"
	git config --global user.name "Flávio Stutz"
	npm version from-git
	npm publish

all: build lint test
