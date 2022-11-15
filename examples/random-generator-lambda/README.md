# random-generator-lambda

This is a complete example of a AWS Lambda function using Serverless Framework and Middy with Idempotender making sure the call is idempotent.

## How to run

- Checkout this repo

- Run commands

```sh
cd examples/random-generator-lambda
make start

# in another terminal
curl -v http://localhost:3000/local/random/number
```

- In this example, the idempotency timeout is 5s, so each 5s you will see a new result from the endpoint

- Example results:

```sh
* Connected to localhost (127.0.0.1) port 3000 (#0)
> GET /local/random/number HTTP/1.1
> Host: localhost:3000
> User-Agent: curl/7.64.1
> Accept: */*
> 
< HTTP/1.1 200 OK
< access-control-allow-origin: *
< x-idempotency-from: 2022-11-15T16:48:55.158Z
< content-type: application/json; charset=utf-8
< cache-control: no-cache
< content-length: 57
< accept-ranges: bytes
< Date: Tue, 15 Nov 2022 16:48:55 GMT
< Connection: keep-alive
< Keep-Alive: timeout=5
< 
* Connection #0 to host localhost left intact
{"number":14296,"timestamp":"2022-11-15T16:48:55.157Z"}*
```

- The header 'x-idempotency-from' indicates this execution used a previous result from the first request

- If you run multiple times this command you will see the '{ "number": 14296 }' result changing each 5s, because the idempotency for this endpoint is expired each 5s.
