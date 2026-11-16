# DDS ON Master

Painel do proprietário para controlar empresas, contas e dados do DDS-ON (mesmo banco de dados).

## Acesso e segurança

O login e **todas** as telas e rotas da API exigem a sessão mestre (cookie `dds_master_session`, assinado com HMAC-SHA256, HttpOnly, 12 h). Não há credenciais padrão no código: sem as variáveis abaixo, o login fica desativado.

| Variável (Vercel → Settings → Environment Variables) | Regra |
| --- | --- |
| `MASTER_EMAIL` | e-mail do administrador master |
| `MASTER_PASSWORD` | senha com 12 caracteres ou mais |
| `MASTER_KEY` | chave de segurança pedida no login |
| `MASTER_SESSION_SECRET` | texto aleatório com 32 caracteres ou mais (trocar invalida todas as sessões) |
| `DATABASE_URL` | o mesmo banco do DDS-ON |

## Controle de acesso do DDS-ON

- Cadastro no DDS-ON em empresa existente **com a palavra-chave** da empresa → conta ativa.
- Sem chave, chave errada ou empresa que ainda não existe → conta **aguardando aprovação** na fila do Master.
- No Master: criar empresa e definir/trocar a palavra-chave, aprovar, bloquear, vincular à empresa e definir o papel (organizador ou administrador da empresa).
- "Excluir" usuário **bloqueia** o acesso e preserva DDS, assinaturas e atas.

## Banco de dados: nunca rodar `prisma db push`

O DDS-ON e o Master usam o mesmo banco, mas cada `schema.prisma` conhece só parte das tabelas (o Master não conhece competições, DDS Semanal, colaboradores e planos de ação; o DDS-ON não conhece `AuditLog`). Um `prisma db push` de qualquer um dos lados **apagaria as tabelas do outro**. Cada sistema cria as próprias tabelas com SQL idempotente (`CREATE TABLE IF NOT EXISTS`).
