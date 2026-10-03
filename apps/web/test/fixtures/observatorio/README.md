# Oracle of the Observatório engine — DO NOT EDIT
Byte copies of the approved mockup engine and its 190-assertion suite
(docs/superpowers/mockups/2026-10-02-observatorio/, commit 353492d3).
The production engine (src/lib/youtube/observatorio) must reproduce them:
- test/youtube/observatorio/mockup-suite.test.ts runs dados-teste.html VERBATIM against the production facade;
- *-parity.test.ts compares production outputs with this oracle on the same data.
sha256:
ee0de1c5edaf319562bbaeb25794ea766fd5ac9776a5e2e32708675adf907487  dados.cjs
010cbfbbd245db4269dc0d51e24d6fe2cb8e1704c85fad4a6dddbc0815e967c2  dados-teste.html
2a6872e7af79e31319659c3cfc2ae92d2ae0e89a06876879351f06f4b29d2824  segundo-canal.cjs

segundo-canal.cjs: cópia de `docs/superpowers/mockups/2026-10-03-observatorio-seus-canais/segundo-canal.js`; carregar ANTES de `dados.cjs`.
