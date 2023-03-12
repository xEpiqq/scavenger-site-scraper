#!/bin/bash

function_name="$1"

aws lambda delete-function \
  --function-name "$function_name"
