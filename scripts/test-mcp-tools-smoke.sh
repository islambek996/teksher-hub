#!/usr/bin/env bash
set -euo pipefail

: "${MCP_URL:?MCP_URL is required}"
: "${MCP_TOKEN:?MCP_TOKEN is required}"
: "${MCP_SESSION_ID:?MCP_SESSION_ID is required}"

WORK_DIR="${RUNNER_TEMP:-/tmp}/teksher-mcp-smoke"
mkdir -p "$WORK_DIR"

mcp_call() {
  local request_id="$1"
  local tool_name="$2"
  local arguments="$3"
  local response_file="$WORK_DIR/${tool_name}.response"
  local text_file="$WORK_DIR/${tool_name}.json"
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
    -H "Authorization: Bearer $MCP_TOKEN" \
    -H "Mcp-Session-Id: $MCP_SESSION_ID" \
    -H 'MCP-Protocol-Version: 2025-03-26' \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json, text/event-stream' \
    --data "$payload")

  if [ "$status" != "200" ]; then
    echo "MCP tool $tool_name returned HTTP $status" >&2
    cat "$response_file" >&2
    return 1
  fi

  # Streamable HTTP may return a JSON body or a Server-Sent Events message.
  if jq -e . "$response_file" >/dev/null 2>&1; then
    rpc_response=$(cat "$response_file")
  else
    rpc_response=$(sed -n 's/^data:[[:space:]]*//p' "$response_file" | tail -n 1)
  fi

  if [ -z "$rpc_response" ] || ! printf '%s' "$rpc_response" | jq -e \
      'has("result") and (.error == null) and (.result.isError != true)' >/dev/null; then
    echo "MCP tool $tool_name returned an invalid or error JSON-RPC result" >&2
    cat "$response_file" >&2
    return 1
  fi

  tool_text=$(printf '%s' "$rpc_response" | jq -r \
    '.result.content[]? | select(.type == "text") | .text' | head -n 1)
  if [ -z "$tool_text" ]; then
    echo "MCP tool $tool_name returned no text content" >&2
    printf '%s\n' "$rpc_response" >&2
    return 1
  fi

  printf '%s' "$tool_text" > "$text_file"
  if ! jq -e --arg expected "$tool_name" '.tool == $expected' "$text_file" >/dev/null; then
    echo "MCP tool $tool_name returned an unexpected payload" >&2
    cat "$text_file" >&2
    return 1
  fi

  cat "$text_file"
}

echo "Calling search_npa..." >&2
NPA=$(mcp_call 10 search_npa '{"query":"маркировка","jurisdiction":"RU","document_number":"515"}')
printf '%s' "$NPA" | jq -e '.data.results | any(.[]; (.documentNumber // "" | contains("515")))'

echo "Calling search_product_groups..." >&2
PRODUCT_GROUPS=$(mcp_call 11 search_product_groups '{"query":"детские игрушки"}')
printf '%s' "$PRODUCT_GROUPS" | jq -e '.data | has("mzkmGroups") and has("externalGroups") and has("internalGroups") and has("groupDetails") and has("relatedKnowledgeCards")'

echo "Calling check_tnved_code..." >&2
TNVED=$(mcp_call 12 check_tnved_code '{"code":"9503005500"}')
printf '%s' "$TNVED" | jq -e '.data.matchType == "EXACT_10_DIGIT" and (.data.catalogTotalMatches > 0) and .data.legalConclusion == "NOT_DETERMINED"'

echo "Calling get_business_process..." >&2
PROCESS=$(mcp_call 13 get_business_process '{"query":"регистрация"}')
printf '%s' "$PROCESS" | jq -e '.data.processes | any(.[]; .id == "registration" and (.steps | length) > 0)'

echo "Calling get_source_monitor_status..." >&2
MONITORS=$(mcp_call 14 get_source_monitor_status '{"jurisdiction":"KG"}')
printf '%s' "$MONITORS" | jq -e '.data.monitors | type == "array" and length > 0'

echo "Calling list_source_change_events..." >&2
EVENTS=$(mcp_call 15 list_source_change_events '{"jurisdiction":"KG","limit":5}')
printf '%s' "$EVENTS" | jq -e '.data.events | type == "array"'

echo "All six authenticated MCP tool calls passed." >&2
