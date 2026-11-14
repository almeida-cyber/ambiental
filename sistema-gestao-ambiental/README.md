# Sistema de Gestão Ambiental (SGA)

Aplicação web inicial para cadastro de relatórios mensais, atividades ambientais, fotografias e consolidação anual.

## Tecnologias
- HTML, CSS e JavaScript (ES Modules)
- Firebase Authentication (e-mail/senha)
- Cloud Firestore
- Firebase Storage
- Vercel ou Firebase Hosting

## 1. Preparar o Firebase
1. Crie um projeto em https://console.firebase.google.com.
2. Registre um aplicativo Web e copie a configuração.
3. Em Authentication > Sign-in method, habilite E-mail/senha.
4. Em Authentication > Users, crie manualmente o único usuário autorizado.
5. Crie o Firestore Database.
6. Ative o Storage.
7. Cole a configuração em `js/firebase-config.js`.
8. Publique as regras de `firestore.rules` e `storage.rules` nos respectivos consoles.

**Importante:** não existe cadastro público de usuários. Crie o usuário autorizado manualmente no Firebase Authentication. As regras vinculam os dados ao UID autenticado. Antes de uso oficial, valide as regras e a política de acesso com o responsável técnico da Prefeitura.

## 2. Executar localmente
Como o projeto usa módulos JavaScript, abra a pasta por um servidor local, não por `file://`.
- VS Code: instale a extensão Live Server e clique em "Open with Live Server".
- Ou use `npx serve .` em um terminal, dentro da pasta.

## 3. Publicar
Envie os arquivos ao GitHub e importe o repositório na Vercel. Não é necessário build command; a pasta raiz é a publicação.

## 4. Funcionalidades já incluídas
- Login por e-mail e senha.
- Dashboard com indicadores anuais.
- Cadastro, edição, consulta e exclusão de relatórios mensais.
- Várias atividades por relatório.
- Upload de fotografias por atividade.
- Identificação da Prefeitura, Secretaria e responsável.
- Consolidação anual.
- Exportação Word compatível (.doc) e impressão do relatório (na janela de impressão, selecione "Salvar como PDF").

## 5. Próximas melhorias recomendadas antes de produção
- Adicionar edição e exclusão individual de fotografias antigas.
- Validar limites de tamanho, formatos e conteúdo no Storage.
- Adicionar trilha de auditoria e cópias de segurança.
- Criar cabeçalho/rodapé institucional e campos de assinatura.
- Avaliar LGPD, retenção de imagens e autorização de uso de imagem de alunos e participantes.
- Testar em celular e computador com dados reais não sensíveis.

## Observações
A exportação Word gera um arquivo HTML compatível com Microsoft Word, com extensão `.doc`. A exportação PDF usa a função de impressão do navegador; escolha "Salvar como PDF". Para um PDF com paginação avançada e geração no servidor, recomenda-se uma etapa posterior com biblioteca própria de PDF.
