#!/bin/bash
set -e

if [ -z "$NSQLOOKUPD_ADDRESSES" ]; then
    echo "NSQLOOKUPD_ADDRESSES environment variable required"
    exit 1
fi

if [ -z "$NSQD_ADDRESS" ]; then
    echo "NSQD_ADDRESS environment variable required"
    exit 1
fi

if [ -z "$S3_BUCKET" ]; then
    echo "S3_BUCKET environment variable required"
    exit 1
fi

if [ -z "$S3_REGION" ]; then
    echo "S3_REGION environment variable required"
    exit 1
fi

# execute nodejs application
exec npm start