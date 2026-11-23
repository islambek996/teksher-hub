#!/usr/bin/env bash
set -euo pipefail

: "${MCP_URL:?MCP_URL is required}"
: "${MCP_ADMIN_TOKEN:?MCP_ADMIN_TOKEN is required}"
: "${MCP_EDITOR_TOKEN:?MCP_EDITOR_TOKEN is required}"
: "${MCP_READER_TOKEN:?MCP_READER_TOKEN is required}"
: "${MCP_DRAFT_PROCESS_ID:?MCP_DRAFT_PROCESS_ID is required}"

WORK_DIR="${RUNNER_TEMP:-/tmp}/teksher-mcp-role-smoke"
mkdir -p "$WORK_DIR"

initialize_role_session() {
  local role="$1"
  local token="$2"
  local headers="$WORK_DIR/$role.headers"
  local body="$WORK_DIR/$role.initialize.json"
  local status
  local session_id
  local initialized_status

  status=$(curl --silent --show-error --max-time 20 \
    --dump-header "$headers" --output "$body" --write-out '%{http_code}' \
    -X POST "$MCP_URL" \
    -H "Authorization: Bearer $token" \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json, text/event-stream' \
    --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"teksher-role-ci","version":"1.0"}}}')

  if [ "$status" != "200" ]; then
    echo "MCP initialize for $role returned HTTP $status" >&2
    cat "$body" >&2
    return 1
  fi

  session_id=$(grep -i '^Mcp-Session-Id:' "$headers" | tail -n 1 | cut -d: -f2- | tr -d '[:space:]')
  if [ -z "$session_id" ]; then
    echo "MCP initialize for $role returned no session ID" >&2
    return 1
  fi

  initialized_status=$(curl --silent --show-error --max-time 20 \
    --output "$WORK_DIR/$role.initialized.txt" --write-out '%{http_code}' \
    -X POST "$MCP_URL" \
    -H "Authorization: Bearer $token" \
    -H "Mcp-Session-Id: $session_id" \
    -H 'MCP-Protocol-Version: 2025-03-26' \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json, text/event-stream' \
    --data '{"jsonrpc":"2.0","method":"notifications/initialized"}')

  if [ "$initialized_status" != "200" ] && [ "$initialized_status" != "202" ]; then
    echo "MCP initialized notification for $role returned HTTP $initialized_status" >&2
    cat "$WORK_DIR/$role.initialized.txt" >&2
    return 1
  fi

  printf '%s' "$session_id"
}

call_role_tool() {
  local role="$1"
  local token="$2"
  local session_id="$3"
  local request_id="$4"
  local tool_name="$5"
  local arguments="$6"
  local response_file="$WORK_DIR/$role-$tool_name.response"
  local payload
  local status
  local rpc_response
  local tool_text

  payload=$(jq -cn \
    --argjson id "$request_id" \
    --arg name "$tool_name" \
    --argjson args "$arguments" \
    '{jsonrpc:"2.0",id:$id,method:"tools/call",params:{name:$name,arguments:$args}}')

  status=$(curl --silent --show-error --max-time 25 \
    --output "$response_file" --write-out '%{http_code}' \
    -X POST "$MCP_URL" \
    -H "Authorization: Bearer $token" \
    -H "Mcp-Session-Id: $session_id" \
    -H 'MCP-Protocol-Version: 2025-03-26' \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json, text/event-stream' \
    --data "$payload")

  if [ "$status" != "200" ]; then
    echo "MCP $role/$tool_name returned HTTP $status" >&2
    cat "$response_file" >&2
    return 1
  fi

  if jq -e . "$response_file" >/dev/null 2>&1; then
    rpc_response=$(cat "$response_file")
  else
    rpc_response=$(sed -n 's/^data:[[:space:]]*//p' "$response_file" | tail -n 1)
  fi

  if [ -z "$rpc_response" ] || ! printf '%s' "$rpc_response" | jq -e \
      'has("result") and (.error == null) and (.result.isError != true)' >/dev/null; then
    echo "MCP $role/$tool_name returned an invalid or error JSON-RPC result" >&2
    cat "$response_file" >&2
    return 1
  fi

  tool_text=$(printf '%s' "$rpc_response" | jq -r \
    '.result.content[]? | select(.type == "text") | .text' | head -n 1)
  if [ -z "$tool_text" ]; then
    echo "MCP $role/$tool_name returned no text content" >&2
    printf '%s\n' "$rpc_response" >&2
    return 1
  fi

  printf '%s' "$tool_text"
}

ADMIN_SESSION=$(initialize_role_session ADMIN "$MCP_ADMIN_TOKEN")
EDITOR_SESSION=$(initialize_role_session EDITOR "$MCP_EDITOR_TOKEN")
READER_SESSION=$(initialize_role_session READER "$MCP_READER_TOKEN")

echo "Checking restricted NPA visibility by role..." >&2
ADMIN_NPA=$(call_role_tool ADMIN "$MCP_ADMIN_TOKEN" "$ADMIN_SESSION" 30 search_npa '{"query":"515","jurisdiction":"RU","document_number":"515"}')
EDITOR_NPA=$(call_role_tool EDITOR "$MCP_EDITOR_TOKEN" "$EDITOR_SESSION" 31 search_npa '{"query":"515","jurisdiction":"RU","document_number":"515"}')
READER_NPA=$(call_role_tool READER "$MCP_READER_TOKEN" "$READER_SESSION" 32 search_npa '{"query":"515","jurisdiction":"RU","document_number":"515"}')

printf '%s' "$ADMIN_NPA" | jq -e '.data.results | any(.[]; (.documentNumber // "" | contains("515")))'
printf '%s' "$EDITOR_NPA" | jq -e '.data.results | any(.[]; (.documentNumber // "" | contains("515")))'
printf '%s' "$READER_NPA" | jq -e '.data.results | length == 0'

echo "Checking draft business-process visibility by role..." >&2
PROCESS_QUERY='CI business process guide'
ARGS=$(jq -cn --arg q "$PROCESS_QUERY" '{query:$q}')
ADMIN_PROCESS=$(call_role_tool ADMIN "$MCP_ADMIN_TOKEN" "$ADMIN_SESSION" 33 get_business_process "$ARGS")
EDITOR_PROCESS=$(call_role_tool EDITOR "$MCP_EDITOR_TOKEN" "$EDITOR_SESSION" 34 get_business_process "$ARGS")
READER_PROCESS=$(call_role_tool READER "$MCP_READER_TOKEN" "$READER_SESSION" 35 get_business_process "$ARGS")

printf '%s' "$ADMIN_PROCESS" | jq -e --arg id "$MCP_DRAFT_PROCESS_ID" '.data.processes | any(.[]; .id == $id)'
printf '%s' "$EDITOR_PROCESS" | jq -e --arg id "$MCP_DRAFT_PROCESS_ID" '.data.processes | any(.[]; .id == $id)'
printf '%s' "$READER_PROCESS" | jq -e --arg id "$MCP_DRAFT_PROCESS_ID" '.data.processes | all(.[]; .id != $id)'

echo "MCP role access matrix passed: ADMIN and EDITOR see privileged materials; READER does not." >&2
