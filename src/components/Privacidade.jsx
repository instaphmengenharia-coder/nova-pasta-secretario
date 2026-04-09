const FONT = "'Google Sans', 'Roboto', sans-serif"

export default function Privacidade() {
  return (
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: FONT, color: '#202124' }}>
      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #e8eaed', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <span style={{ fontSize: 24 }}>📚</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#202124' }}>Secretário Escolar</span>
        </a>
        <a href="/" style={{ padding: '8px 20px', borderRadius: 24, border: 'none', background: '#1a73e8', color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
          Voltar ao início
        </a>
      </nav>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 80px' }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Política de Privacidade</h1>
        <p style={{ color: '#5f6368', fontSize: 14, marginBottom: 40 }}>Última atualização: abril de 2026</p>

        <Section title="1. Quem somos">
          <p>O <strong>Secretário Escolar</strong> é um assistente de IA desenvolvido para auxiliar estudantes brasileiros a organizarem e entregarem atividades no Google Classroom. Operado por João Paulo Costa Bezerra, com sede no Brasil.</p>
          <p>Contato: <a href="mailto:joaopaulocosb@gmail.com" style={{ color: '#1a73e8' }}>joaopaulocosb@gmail.com</a></p>
        </Section>

        <Section title="2. Dados que coletamos">
          <ul>
            <li><strong>Dados da conta Google:</strong> nome, e-mail e foto de perfil — obtidos via OAuth 2.0 com seu consentimento explícito.</li>
            <li><strong>Dados do Google Classroom:</strong> lista de cursos, atividades e prazos — lidos apenas durante o uso ativo do app.</li>
            <li><strong>Número de WhatsApp (opcional):</strong> informado voluntariamente para receber notificações de entrega.</li>
            <li><strong>Dados de uso:</strong> quantidade de créditos consumidos, modelo de IA utilizado e custo por chamada — para fins de cobrança e melhoria do serviço.</li>
            <li><strong>Dados de pagamento:</strong> processados exclusivamente pelo MercadoPago. Não armazenamos número de cartão nem dados bancários.</li>
          </ul>
        </Section>

        <Section title="3. Como usamos os dados">
          <ul>
            <li>Autenticar sua identidade via Google OAuth</li>
            <li>Gerar respostas de IA para suas atividades escolares</li>
            <li>Entregar atividades automaticamente no Classroom (somente quando você autoriza)</li>
            <li>Enviar notificações de confirmação via WhatsApp (somente se você fornecer o número)</li>
            <li>Calcular e cobrar o consumo de créditos</li>
            <li>Melhorar a qualidade das respostas geradas</li>
          </ul>
        </Section>

        <Section title="4. Compartilhamento de dados">
          <p>Seus dados <strong>nunca são vendidos</strong>. Compartilhamos apenas com:</p>
          <ul>
            <li><strong>Anthropic (Claude API):</strong> o texto das suas atividades é enviado para geração de respostas. <a href="https://www.anthropic.com/privacy" target="_blank" rel="noreferrer" style={{ color: '#1a73e8' }}>Política de Privacidade da Anthropic</a>.</li>
            <li><strong>Google:</strong> para autenticação e acesso ao Classroom. <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" style={{ color: '#1a73e8' }}>Política de Privacidade do Google</a>.</li>
            <li><strong>MercadoPago:</strong> para processamento de pagamentos. <a href="https://www.mercadopago.com.br/privacidade" target="_blank" rel="noreferrer" style={{ color: '#1a73e8' }}>Política de Privacidade do MercadoPago</a>.</li>
            <li><strong>Supabase:</strong> banco de dados onde seus dados são armazenados com criptografia em repouso.</li>
          </ul>
        </Section>

        <Section title="5. Retenção de dados">
          <p>Mantemos seus dados enquanto sua conta estiver ativa. Ao solicitar a exclusão da conta por e-mail, apagamos todos os seus dados em até 30 dias, exceto registros necessários por obrigação legal.</p>
        </Section>

        <Section title="6. Seus direitos (LGPD)">
          <p>Conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018), você tem direito a:</p>
          <ul>
            <li>Acessar os dados que temos sobre você</li>
            <li>Corrigir dados incompletos ou desatualizados</li>
            <li>Solicitar a exclusão dos seus dados</li>
            <li>Revogar o consentimento a qualquer momento</li>
            <li>Portabilidade dos dados</li>
          </ul>
          <p>Para exercer qualquer direito, entre em contato: <a href="mailto:joaopaulocosb@gmail.com" style={{ color: '#1a73e8' }}>joaopaulocosb@gmail.com</a></p>
        </Section>

        <Section title="7. Segurança">
          <p>Utilizamos HTTPS em todas as comunicações, tokens OAuth com escopo mínimo necessário, e armazenamento criptografado no Supabase. Senhas nunca são armazenadas — o login é exclusivamente via Google.</p>
        </Section>

        <Section title="8. Cookies e armazenamento local">
          <p>Usamos <code>localStorage</code> e <code>chrome.storage.local</code> (na extensão) para armazenar preferências e tokens de sessão. Não utilizamos cookies de rastreamento de terceiros.</p>
        </Section>

        <Section title="9. Extensão do Chrome">
          <p>A extensão "Secretário Escolar — IA para o Classroom" acessa:</p>
          <ul>
            <li><strong>activeTab / scripting / tabs:</strong> para ler e interagir com páginas do Classroom</li>
            <li><strong>storage:</strong> para salvar seu userId e preferências localmente</li>
          </ul>
          <p>A extensão não coleta dados de navegação fora do domínio classroom.google.com.</p>
        </Section>

        <Section title="10. Alterações nesta política">
          <p>Notificaremos sobre mudanças significativas por e-mail ou pelo próprio app. O uso continuado após as alterações implica concordância com a nova versão.</p>
        </Section>

        <div style={{ marginTop: 48, padding: 24, background: '#f8f9fa', borderRadius: 12 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Termos de Uso</h2>
          <p style={{ marginBottom: 12 }}>Ao usar o Secretário Escolar, você concorda que:</p>
          <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
            <li>Você é o titular da conta Google utilizada</li>
            <li>Usará o serviço de acordo com as regras da sua instituição de ensino</li>
            <li>Não tentará contornar os limites de crédito ou usar o serviço de forma abusiva</li>
            <li>O conteúdo gerado pela IA é sugestivo e pode conter imprecisões — você é responsável pela revisão</li>
            <li>O serviço pode ser suspenso em caso de uso indevido</li>
          </ul>
          <p style={{ marginTop: 16, fontSize: 13, color: '#5f6368' }}>
            Dúvidas? <a href="mailto:joaopaulocosb@gmail.com" style={{ color: '#1a73e8' }}>joaopaulocosb@gmail.com</a>
          </p>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: '#202124' }}>{title}</h2>
      <div style={{ fontSize: 15, lineHeight: 1.8, color: '#3c4043' }}>{children}</div>
    </div>
  )
}
