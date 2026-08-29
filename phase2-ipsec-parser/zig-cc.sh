#!/bin/bash
# Filter out unsupported flags for Zig
args=()
skip_next=false
for arg in "$@"; do
    if [[ "$skip_next" == true ]]; then
        skip_next=false
        continue
    fi
    case "$arg" in
        -exported_symbols_list|-Wl,-exported_symbols_list)
            skip_next=true
            continue
            ;;
        -Wl,-exported_symbols_list,*)
            continue
            ;;
        -Wl,-dead_strip)
            continue
            ;;
        *.a)
            continue
            ;;
        -l*)
            continue
            ;;
        *)
            args+=("$arg")
            ;;
    esac
done
exec /Users/it4/zig/zig cc -target x86_64-macos "${args[@]}"
