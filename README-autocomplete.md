# 🔍 Sistema de Busca com Autocomplete para Produtos

## Implementação:
- **Passo 1**: *Criar projeto no Google Cloud*
- Acesse: https://console.cloud.google.com/
- Clique em “Selecionar projeto” > “Novo projeto”
- Dê um nome (ex: crm-grafica) e clique em Criar
- **Passo 2**: *Ativar a API do Google Sheets*
- No projeto criado, vá no menu esquerdo: API e serviços > Biblioteca
- Pesquise por: Google Sheets API
- Clique nela e depois clique em Ativar
- **Passo 3**: *Criar credenciais*
- Acesse: API e serviços > Credenciais
- Clique em Criar credenciais > Conta de serviço
- Preencha o nome (ex: crm-pdv-service) e clique em Concluir
- Na lista de contas de serviço, clique sobre a que você criou
- Vá na aba Chaves, clique em Adicionar chave > JSON
- O arquivo credentials.json será baixado no seu computador
- **Passo 4**: *Compartilhar sua planilha com a conta da API*
- No credentials.json, procure pelo campo "client_email" (exemplo: crm-pdv@nomeprojeto.iam.gserviceaccount.com)
- Vá até sua planilha do Google:
- Financeiro Gráfica por exemplo
- A url da planilha Adicione no Services/googleSheetsServices, na variável `const spreadsheetId`

Acesse a porta do projeto e pronto, tudo configurado.

** Planilha deve conter as seguintes abas e colunas, lembrando que as colunas precisam estar na mesma ordem.
**Avisos**
- DataHora	
- Para (Para quem vai o aviso, busca dos colaboradores cadastrados)
- WhatsApp Cliente (whatsapp de alguém para link rápido)
- Texto

**Produtos**
- Produto	(Nome do produto)
- Custo dos Materiais (R$)	(Custo do produto)
- Preço de Venda (R$)	(Valor de venda)
- Lucro (R$)	(Formula: =C3-B3)
- Margem (%)	(Formula: =SEERRO(D3/B3;0))
- Tipo	(unidade | metro)
- Minimo (Valor minimo definido para o produto mesmo que o total senha inferior, ele vai mostrar o valor minimo ex: banner 10cm x 10cm - valor real R$4,00 e valor minimo é R$20,00)

**Pedidos**
- Data hora	
- Local Entrega	
- N. Pedido	
- Cliente	
- Telefone	
- E-mail	
- Desconto	
- Valor Total	
- Valor Pago	
- Valor Restante	
- Data entrega	
- Status	
- Observação	
- Vendedor

**Vendas**
- Data	
- Loja	
- ID Pedido	
- Produto	
- QTD	
- Custo (R$)	
- Valor Total (R$)	
- Desconto	
- Valor Pago (R$)	
- Valor Restante (R$)	
- Forma pagamento	
- STATUS	
- Observação	
- Valor un.

**Vendedores*
- NOME
- Login (pode ser e-mail ou login mesmo sem espaço)
- Senha (padrão - $2b$10$AOsYjnws3spqkIe3NbyhpeXhthFRNlgl3sTSzY/vg8kt3USZeM1eq)