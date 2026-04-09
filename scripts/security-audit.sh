#!/bin/bash

# Security Audit Script for Node.js/Next.js Projects
# Scan → Auto-fix (quando seguro) → Explica cada problema

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCAN_DIR="${1:-.}"
EXCLUDE_DIRS="node_modules|.next|dist|build|.git|coverage|scripts"
REPORT_FILE="security-audit-report.txt"

TMP_HIGH=$(mktemp)
TMP_MEDIUM=$(mktemp)
TMP_FIXED=$(mktemp)
echo 0 > "$TMP_HIGH"
echo 0 > "$TMP_MEDIUM"
echo 0 > "$TMP_FIXED"

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  Security Audit — Scan + Fix + Explain${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo "Diretório: $SCAN_DIR"
echo ""

cat > "$REPORT_FILE" << EOF
Security Audit Report
Gerado: $(date)
Diretório: $SCAN_DIR

================================================
ACHADOS + EXPLICAÇÕES
================================================

EOF

# ── Explanations ─────────────────────────────────────────────────────────────
declare -A EXPLAIN
EXPLAIN["eval()"]="eval() executa uma string como código JavaScript em runtime. Um atacante que controle essa string pode executar qualquer código no servidor ou no browser. Use alternativas: JSON.parse() para dados, ou funções explícitas no lugar de código dinâmico."
EXPLAIN["Function()"]="new Function(str) é equivalente a eval() — cria e executa código a partir de uma string. Substitua por funções normais ou por um mapa de handlers."
EXPLAIN["exec/execSync"]="child_process.exec() passa o comando para o shell do sistema operacional. Se algum argumento vier de input do usuário, é possível injetar comandos (ex: '; rm -rf /'). Use execFile() ou spawn() sem shell para passar args como array."
EXPLAIN["spawn shell:true"]="spawn() com shell:true ativa o shell do SO, abrindo a mesma vulnerabilidade de command injection do exec(). Remova shell:true e passe os argumentos como array."
EXPLAIN["VM module"]="O módulo vm do Node roda código em um contexto separado, mas não é um sandbox seguro — um atacante ainda pode escapar e acessar o processo principal. Evite executar código não confiável."
EXPLAIN["dynamic require"]="require() com variável dinâmica pode carregar módulos arbitrários do sistema se o valor vier de input externo. Use um mapa estático de módulos permitidos."
EXPLAIN["dynamic import"]="import() dinâmico com variável pode importar arquivos arbitrários. Use apenas strings literais ou um mapa de imports permitidos."
EXPLAIN["dangerouslySetInnerHTML"]="dangerouslySetInnerHTML insere HTML diretamente no DOM sem sanitização — porta aberta para XSS. Use DOMPurify para sanitizar antes: { __html: DOMPurify.sanitize(str) }."
EXPLAIN["setTimeout string"]="setTimeout('código', ms) avalia uma string como código — equivalente a eval(). Sempre passe uma função: setTimeout(() => { ... }, ms)."
EXPLAIN["readFile"]="fs.readFile com caminho construído dinamicamente pode vazar arquivos do sistema se o path vier de input do usuário (ex: ../../etc/passwd). Valide o caminho com path.resolve() e verifique que fica dentro do diretório permitido."
EXPLAIN["writeFile"]="fs.writeFile com caminho dinâmico pode sobrescrever arquivos do sistema. Valide o destino com path.resolve() + verificação de prefixo."
EXPLAIN["unlink"]="fs.unlink pode deletar arquivos arbitrários do sistema se o caminho não for validado. Sempre resolva e valide o caminho antes de deletar."
EXPLAIN["path traversal"]="O padrão ../ em strings runtime pode ser usado para acessar arquivos fora do diretório permitido. Use path.resolve() e verifique que o resultado começa com o diretório base."
EXPLAIN["createReadStream"]="createReadStream com caminho dinâmico tem o mesmo risco que readFile — vaza arquivos do sistema. Valide o caminho."
EXPLAIN["createWriteStream"]="createWriteStream com caminho dinâmico pode sobrescrever arquivos do sistema. Valide o caminho."
EXPLAIN["__dirname concat"]="Concatenar __dirname com + e uma string variável em vez de usar path.join() pode resultar em path traversal se a variável contiver ../. Use: path.join(__dirname, variavel) e valide o resultado."
EXPLAIN["process.cwd concat"]="Mesmo risco que __dirname +. Use path.join(process.cwd(), variavel) e valide."
EXPLAIN["readdir"]="fs.readdir lista arquivos de um diretório — pode expor estrutura interna se o path vier de input. Valide o diretório."
EXPLAIN["existsSync"]="fs.existsSync com caminho dinâmico pode revelar a existência de arquivos sensíveis via timing ou resposta. Valide o caminho."

# ── Auto-fix functions ────────────────────────────────────────────────────────

# Fix: __dirname + 'str' → path.join(__dirname, 'str')
fix_dirname_concat() {
    local file=$1
    # Só corrige padrões simples: __dirname + '/algo' ou __dirname + "/algo"
    if grep -qE "__dirname\s*\+\s*['\"]" "$file" 2>/dev/null; then
        # Verifica se já importa path
        if ! grep -qE "^import path|require\('path'\)|require\(\"path\"\)" "$file" 2>/dev/null; then
            # Adiciona import path na primeira linha
            sed -i '1s/^/import path from '\''path'\''\n/' "$file" 2>/dev/null || \
            sed -i '' '1s/^/import path from '\''path'\''\n/' "$file" 2>/dev/null
        fi
        # Substitui __dirname + 'X' por path.join(__dirname, 'X')
        sed -i -E "s/__dirname\s*\+\s*'([^']*)'/path.join(__dirname, '\1')/g" "$file" 2>/dev/null || \
        sed -i '' -E "s/__dirname\s*\+\s*'([^']*)'/path.join(__dirname, '\1')/g" "$file" 2>/dev/null
        sed -i -E 's/__dirname\s*\+\s*"([^"]*)"/path.join(__dirname, "\1")/g' "$file" 2>/dev/null || \
        sed -i '' -E 's/__dirname\s*\+\s*"([^"]*)"/path.join(__dirname, "\1")/g' "$file" 2>/dev/null
        echo $(( $(cat "$TMP_FIXED") + 1 )) > "$TMP_FIXED"
        return 0
    fi
    return 1
}

# Fix: process.cwd() + 'str' → path.join(process.cwd(), 'str')
fix_cwd_concat() {
    local file=$1
    if grep -qE "process\.cwd\(\)\s*\+\s*['\"]" "$file" 2>/dev/null; then
        if ! grep -qE "^import path|require\('path'\)|require\(\"path\"\)" "$file" 2>/dev/null; then
            sed -i '1s/^/import path from '\''path'\''\n/' "$file" 2>/dev/null || \
            sed -i '' '1s/^/import path from '\''path'\''\n/' "$file" 2>/dev/null
        fi
        sed -i -E "s/process\.cwd\(\)\s*\+\s*'([^']*)'/path.join(process.cwd(), '\1')/g" "$file" 2>/dev/null || \
        sed -i '' -E "s/process\.cwd\(\)\s*\+\s*'([^']*)'/path.join(process.cwd(), '\1')/g" "$file" 2>/dev/null
        sed -i -E 's/process\.cwd\(\)\s*\+\s*"([^"]*)"/path.join(process.cwd(), "\1")/g' "$file" 2>/dev/null || \
        sed -i '' -E 's/process\.cwd\(\)\s*\+\s*"([^"]*)"/path.join(process.cwd(), "\1")/g' "$file" 2>/dev/null
        echo $(( $(cat "$TMP_FIXED") + 1 )) > "$TMP_FIXED"
        return 0
    fi
    return 1
}

# Fix: setTimeout('str', ...) → avisa mas não auto-fixa (lógica variada)
# Fix: dangerouslySetInnerHTML → avisa mas não auto-fixa (requer DOMPurify)

# ── log + fix ─────────────────────────────────────────────────────────────────
log_finding() {
    local severity=$1
    local key=$2       # chave para lookup da explicação
    local pattern=$3
    local file=$4
    local line_num=$5
    local line_content=$6
    local fixed=${7:-""}

    if [ "$severity" = "HIGH" ]; then
        echo $(( $(cat "$TMP_HIGH") + 1 )) > "$TMP_HIGH"
        echo -e "${RED}[HIGH]${NC} $key"
    else
        echo $(( $(cat "$TMP_MEDIUM") + 1 )) > "$TMP_MEDIUM"
        echo -e "${YELLOW}[MEDIUM]${NC} $key"
    fi

    echo "  Arquivo : $file:$line_num"
    echo "  Código  : $line_content"

    local explanation="${EXPLAIN[$key]:-}"
    if [ -n "$explanation" ]; then
        echo -e "  ${CYAN}Por quê:${NC} $explanation"
    fi

    if [ -n "$fixed" ]; then
        echo -e "  ${GREEN}✓ Auto-corrigido:${NC} $fixed"
    fi
    echo ""

    cat >> "$REPORT_FILE" << EOF
[$severity] $key
Arquivo : $file:$line_num
Código  : $line_content
Por quê : ${EXPLAIN[$key]:-N/A}
${fixed:+Auto-fix: $fixed}

EOF
}

search_and_fix() {
    local pattern=$1
    local severity=$2
    local key=$3
    local auto_fix_fn=${4:-""}   # nome da função de fix, se houver

    while IFS= read -r file; do
        local fixed_msg=""
        # Tenta auto-fix antes de reportar (só para MEDIUM com fix disponível)
        if [ -n "$auto_fix_fn" ] && [ "$severity" = "MEDIUM" ]; then
            if $auto_fix_fn "$file"; then
                fixed_msg="Substituído por path.join() em $file"
            fi
        fi

        while IFS=: read -r line_num line_content; do
            echo "$line_content" | grep -q 'security-audit-ignore' && continue
            log_finding "$severity" "$key" "$pattern" "$file" "$line_num" "$line_content" "$fixed_msg"
            fixed_msg=""  # mostra só no primeiro achado do arquivo
        done < <(grep -nE "$pattern" "$file" 2>/dev/null)
    done < <(find "$SCAN_DIR" -type f \( -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" \) \
        | grep -vE "$EXCLUDE_DIRS")
}

# ── Scans ─────────────────────────────────────────────────────────────────────
echo -e "${BLUE}[1/2] Verificando execução de código...${NC}"
echo ""

search_and_fix '\beval\s*\('                              "HIGH"   "eval()"
search_and_fix 'new\s+Function\s*\('                      "HIGH"   "Function()"
search_and_fix '(exec|execSync)\s*\('                     "HIGH"   "exec/execSync"
search_and_fix 'spawn\s*\([^)]*shell\s*:\s*true'          "HIGH"   "spawn shell:true"
search_and_fix '(runInNewContext|runInThisContext)\s*\('   "HIGH"   "VM module"
search_and_fix 'require\s*\(\s*[^"'"'"']'                 "MEDIUM" "dynamic require"
search_and_fix 'import\s*\(\s*[^"'"'"']'                  "MEDIUM" "dynamic import"
search_and_fix 'dangerouslySetInnerHTML'                   "MEDIUM" "dangerouslySetInnerHTML"
search_and_fix '(setTimeout|setInterval)\s*\(\s*["\x27]'  "MEDIUM" "setTimeout string"

echo ""
echo -e "${BLUE}[2/2] Verificando sistema de arquivos...${NC}"
echo ""

search_and_fix 'fs\.(readFile|readFileSync)\s*\('   "HIGH"   "readFile"
search_and_fix 'fs\.(writeFile|writeFileSync)\s*\(' "HIGH"   "writeFile"
search_and_fix 'fs\.(unlink|unlinkSync)\s*\('       "HIGH"   "unlink"
search_and_fix '[^'"'"'"`]\.\.[/\\][^a-zA-Z]'       "HIGH"   "path traversal"
search_and_fix 'fs\.createReadStream\s*\('          "HIGH"   "createReadStream"
search_and_fix 'fs\.createWriteStream\s*\('         "HIGH"   "createWriteStream"
search_and_fix '__dirname\s*\+'                     "MEDIUM" "__dirname concat"  "fix_dirname_concat"
search_and_fix 'process\.cwd\(\)\s*\+'             "MEDIUM" "process.cwd concat" "fix_cwd_concat"
search_and_fix 'fs\.(readdir|readdirSync)\s*\('     "MEDIUM" "readdir"
search_and_fix 'fs\.existsSync\s*\('               "MEDIUM" "existsSync"

# ── Summary ───────────────────────────────────────────────────────────────────
HIGH_COUNT=$(cat "$TMP_HIGH")
MEDIUM_COUNT=$(cat "$TMP_MEDIUM")
FIXED_COUNT=$(cat "$TMP_FIXED")
rm -f "$TMP_HIGH" "$TMP_MEDIUM" "$TMP_FIXED"

echo ""
echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  RESULTADO${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

if [ "$HIGH_COUNT" -eq 0 ] && [ "$MEDIUM_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✓ Nenhum problema encontrado!${NC}"
else
    [ "$HIGH_COUNT" -gt 0 ]   && echo -e "${RED}Problemas HIGH:   $HIGH_COUNT  (commit bloqueado)${NC}"
    [ "$MEDIUM_COUNT" -gt 0 ] && echo -e "${YELLOW}Problemas MEDIUM: $MEDIUM_COUNT${NC}"
    [ "$FIXED_COUNT" -gt 0 ]  && echo -e "${GREEN}Auto-corrigidos:  $FIXED_COUNT arquivo(s)${NC}"
    echo ""
    [ "$HIGH_COUNT" -gt 0 ] && echo -e "${RED}⚠ Corrija os problemas HIGH antes de commitar.${NC}"
    echo -e "${YELLOW}ℹ Falsos positivos? Adicione o comentário:  // security-audit-ignore: motivo${NC}"
    echo -e "${YELLOW}ℹ Para forçar mesmo assim:  git commit --no-verify${NC}"
fi

echo ""
echo "Relatório completo: $REPORT_FILE"
echo ""

[ "$HIGH_COUNT" -gt 0 ] && exit 1
exit 0
