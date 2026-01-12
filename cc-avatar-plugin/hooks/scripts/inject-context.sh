#!/bin/bash

CONTEXT=$(cat ${CLAUDE_PLUGIN_ROOT}/context/context.md)

echo "\"hookSpecificOutput\": {
  \"hookEventName\": \"SessionStart\",
  \"additionalContext\": \"$CONTEXT\"
}"