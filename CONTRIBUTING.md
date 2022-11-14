# CONTRIBUTING

Thank you for being interested in Idempotender!

## General

This project is organized as a monorepo.

We have the "core" module, which is a plain javascript lib with basic operations for idempotency implementation, and "middy", which uses "core" and implements a Middy middleware on top of it.

Each lib is published separatedly in npm.

## Tools

- Esbuild for bundling
- TSC for typescript checks
- ESlint for general coding rules checks
- Prettier for code formatting
- Jest for testing
- Yarn v3 for package management
- NX for mapping dependencies and triggering yarn targets as needed
  - For example, if you changed a module that is a dependency of another module, it will trigger the builds from the less dependant to the most dependant module

## Basic operations

```sh
make build
make lint
make test
```

## Questions and discussions

- Discuss design or implementation details of a specific feature in the related Issue comments
- If you have more generic question, create a new Issue

## Bugs and feature requests

- If you find any bug, create a new Issue describing what is the structure of your monorepo and what kind of error you had. If possible, send a link of your repo, or a screenshot of its structure.

- If you want a new feature, open an Issue and explain your real use case, the kind of problems you have nowadays and how you think Monolint could help you in practice.

## Prepare your development environment

- Install yarn and "make" on your machine
- Git clone this repo
- Type `make test` to see tests running
- Use preferrebly VSCode with ESLint plugin installed so linting with auto fix will be available

## Pipeline and Publishing to NPM

- Everytime a PR or a commit is made to "master" branch linting and building will be run. Your PR will only be analysed with a successfull GH pipeline run
- When a new tag is created a GH pipeline will publish a release to NPM registry of middy and core libs

