#!/bin/bash

# Security Audit Script for Node.js/Next.js Projects
# Focuses on Code Execution Risks and File System Operations

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

SCAN_DIR="${1:-.}"
EXCLUDE_DIRS="node_modules|.next|dist|build|.git|coverage|scripts"
REPORT_FILE="security-audit-report.txt"

# Usar arquivos temporários para contar (evita bug de subshell)
TMP_HIGH=$(mktemp)
TMP_MEDIUM=$(mktemp)
echo 0 > "$TMP_HIGH"
echo 0 > "$TMP_MEDIUM"

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}Security Audit: Code Execution & File System${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo "Scanning: $SCAN_DIR"
echo ""

cat > "$REPORT_FILE" << EOF
Security Audit Report
Generated: $(date)
Directory: $SCAN_DIR

================================================
FINDINGS
================================================

EOF

log_finding() {
    local severity=$1
    local category=$2
    local pattern=$3
    local file=$4
    local line_num=$5
    local line_content=$6

    if [ "$severity" = "HIGH" ]; then
        echo $(( $(cat "$TMP_HIGH") + 1 )) > "$TMP_HIGH"
        echo -e "${RED}[HIGH]${NC} $category"
    else
        echo $(( $(cat "$TMP_MEDIUM") + 1 )) > "$TMP_MEDIUM"
        echo -e "${YELLOW}[MEDIUM]${NC} $category"
    fi

    echo "  Pattern: $pattern"
    echo "  File: $file:$line_num"
    echo "  Code: $line_content"
    echo ""

    cat >> "$REPORT_FILE" << EOF
[$severity] $category
Pattern: $pattern
File: $file:$line_num
Code: $line_content

EOF
}

search_pattern() {
    local pattern=$1
    local severity=$2
    local category=$3

    while IFS= read -r file; do
        while IFS=: read -r line_num line_content; do
            # Linhas marcadas com "security-audit-ignore" são puladas intencionalmente
            echo "$line_content" | grep -q 'security-audit-ignore' && continue
            log_finding "$severity" "$category" "$pattern" "$file" "$line_num" "$line_content"
        done < <(grep -nE "$pattern" "$file" 2>/dev/null)
    done < <(find "$SCAN_DIR" -type f \( -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" \) \
        | grep -vE "$EXCLUDE_DIRS")
}

echo -e "${BLUE}Verificando execução de código...${NC}"
echo ""

search_pattern '\beval\s*\(' "HIGH" "Code Execution: eval()"
search_pattern 'new\s+Function\s*\(' "HIGH" "Code Execution: Function constructor"
search_pattern '(exec|execSync)\s*\(' "HIGH" "Code Execution: child_process exec"
search_pattern 'spawn\s*\([^)]*shell\s*:\s*true' "HIGH" "Code Execution: spawn with shell:true"
search_pattern '(runInNewContext|runInThisContext|runInContext)\s*\(' "HIGH" "Code Execution: VM module"
search_pattern 'require\s*\(\s*[^"'"'"']' "MEDIUM" "Code Execution: dynamic require()"
search_pattern 'import\s*\(\s*[^"'"'"']' "MEDIUM" "Code Execution: dynamic import()"
search_pattern 'dangerouslySetInnerHTML' "MEDIUM" "Code Execution: dangerouslySetInnerHTML (XSS)"
search_pattern '(setTimeout|setInterval)\s*\(\s*["\x27]' "MEDIUM" "Code Execution: setTimeout/setInterval with string"

echo ""
echo -e "${BLUE}Verificando sistema de arquivos...${NC}"
echo ""

search_pattern 'fs\.(readFile|readFileSync)\s*\(' "HIGH" "File System: readFile"
search_pattern 'fs\.(writeFile|writeFileSync)\s*\(' "HIGH" "File System: writeFile"
search_pattern 'fs\.(unlink|unlinkSync)\s*\(' "HIGH" "File System: file deletion"
# Exclui imports relativos (../algo) — só flagga strings em runtime como path.join('../' + var)
search_pattern '[^'"'"'"`]\.\.[/\\][^a-zA-Z]' "HIGH" "File System: path traversal (../)"
search_pattern 'fs\.createReadStream\s*\(' "HIGH" "File System: createReadStream"
search_pattern 'fs\.createWriteStream\s*\(' "HIGH" "File System: createWriteStream"
search_pattern '__dirname\s*\+' "MEDIUM" "File System: __dirname concatenation"
search_pattern 'process\.cwd\(\)\s*\+' "MEDIUM" "File System: process.cwd() concatenation"
search_pattern 'fs\.(readdir|readdirSync)\s*\(' "MEDIUM" "File System: directory listing"
search_pattern 'fs\.existsSync\s*\(' "MEDIUM" "File System: existsSync"

# ── Summary ──────────────────────────────────────────────────────────────────
HIGH_COUNT=$(cat "$TMP_HIGH")
MEDIUM_COUNT=$(cat "$TMP_MEDIUM")
rm -f "$TMP_HIGH" "$TMP_MEDIUM"

echo ""
echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}RESULTADO DA AUDITORIA${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

if [ "$HIGH_COUNT" -eq 0 ] && [ "$MEDIUM_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✓ Nenhum problema encontrado!${NC}"
else
    [ "$HIGH_COUNT" -gt 0 ]   && echo -e "${RED}Problemas HIGH:   $HIGH_COUNT${NC}"
    [ "$MEDIUM_COUNT" -gt 0 ] && echo -e "${YELLOW}Problemas MEDIUM: $MEDIUM_COUNT${NC}"
    echo ""
    echo -e "${YELLOW}⚠ Revise os achados acima. Falsos positivos são possíveis.${NC}"
fi

echo ""
echo "Relatório salvo em: $REPORT_FILE"
echo ""

[ "$HIGH_COUNT" -gt 0 ] && exit 1
exit 0
