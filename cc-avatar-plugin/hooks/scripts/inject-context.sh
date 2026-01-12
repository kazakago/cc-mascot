#!/bin/bash

CONTEXT=$(cat ${CLAUDE_PLUGIN_ROOT}/contexts/context.md)

echo "\"hookSpecificOutput\": {
  \"hookEventName\": \"SessionStart\",
  \"additionalContext\": \"$CONTEXT\"
}"