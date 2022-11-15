SHELL := /bin/bash

build: install
	npx nx run build-module --verbose --output-style=stream

# Build only this module (without dependencies)
build-module:
	yarn install --frozen-lockfile --ignore-optional

lint:
	npx eslint . --ext .ts
	npx tsc -noEmit --skipLibCheck

test: unit-tests

unit-tests:
	npx jest

package: stagereq
	npx sls package --stage ${STAGE}

deploy: stagereq
	npx sls deploy --stage ${STAGE}

integration-tests:
	curl ${ENVIRONMENT_URL}

undeploy: stagereq
	npx sls remove --stage ${STAGE}

stagereq:
	if [ "${STAGE}" == "" ]; then \
  	  	echo "ENV STAGE is required";\
    	exit 1;\
	fi

start: build
	sls offline --stage local

all: build lint unit-tests deploy

clean: undeploy
	rm -rf node_modules

install: node_modules
	yarn install --frozen-lockfile --ignore-optional