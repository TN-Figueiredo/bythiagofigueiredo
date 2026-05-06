#!/usr/bin/env bash
set -euo pipefail

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Migration Squash — Remote History Repair                    ║"
echo "║  Marks old migrations as reverted, new ones as applied       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

echo "Reverting 196 old migrations..."
echo ""
echo "[1/196] Reverting 20260414000001"
npx supabase migration repair 20260414000001 --status reverted --linked
echo "[2/196] Reverting 20260414000002"
npx supabase migration repair 20260414000002 --status reverted --linked
echo "[3/196] Reverting 20260414000003"
npx supabase migration repair 20260414000003 --status reverted --linked
echo "[4/196] Reverting 20260414000004"
npx supabase migration repair 20260414000004 --status reverted --linked
echo "[5/196] Reverting 20260414000005"
npx supabase migration repair 20260414000005 --status reverted --linked
echo "[6/196] Reverting 20260414000006"
npx supabase migration repair 20260414000006 --status reverted --linked
echo "[7/196] Reverting 20260414000007"
npx supabase migration repair 20260414000007 --status reverted --linked
echo "[8/196] Reverting 20260414000008"
npx supabase migration repair 20260414000008 --status reverted --linked
echo "[9/196] Reverting 20260414000010"
npx supabase migration repair 20260414000010 --status reverted --linked
echo "[10/196] Reverting 20260414000011"
npx supabase migration repair 20260414000011 --status reverted --linked
echo "[11/196] Reverting 20260414000012"
npx supabase migration repair 20260414000012 --status reverted --linked
echo "[12/196] Reverting 20260414000013"
npx supabase migration repair 20260414000013 --status reverted --linked
echo "[13/196] Reverting 20260414000014"
npx supabase migration repair 20260414000014 --status reverted --linked
echo "[14/196] Reverting 20260414000015"
npx supabase migration repair 20260414000015 --status reverted --linked
echo "[15/196] Reverting 20260414000016"
npx supabase migration repair 20260414000016 --status reverted --linked
echo "[16/196] Reverting 20260414000017"
npx supabase migration repair 20260414000017 --status reverted --linked
echo "[17/196] Reverting 20260414000018"
npx supabase migration repair 20260414000018 --status reverted --linked
echo "[18/196] Reverting 20260414000019"
npx supabase migration repair 20260414000019 --status reverted --linked
echo "[19/196] Reverting 20260415000020"
npx supabase migration repair 20260415000020 --status reverted --linked
echo "[20/196] Reverting 20260415000021"
npx supabase migration repair 20260415000021 --status reverted --linked
echo "[21/196] Reverting 20260415000022"
npx supabase migration repair 20260415000022 --status reverted --linked
echo "[22/196] Reverting 20260415000023"
npx supabase migration repair 20260415000023 --status reverted --linked
echo "[23/196] Reverting 20260415000024"
npx supabase migration repair 20260415000024 --status reverted --linked
echo "[24/196] Reverting 20260415000025"
npx supabase migration repair 20260415000025 --status reverted --linked
echo "[25/196] Reverting 20260415000026"
npx supabase migration repair 20260415000026 --status reverted --linked
echo "[26/196] Reverting 20260415000027"
npx supabase migration repair 20260415000027 --status reverted --linked
echo "[27/196] Reverting 20260415000028"
npx supabase migration repair 20260415000028 --status reverted --linked
echo "[28/196] Reverting 20260415000029"
npx supabase migration repair 20260415000029 --status reverted --linked
echo "[29/196] Reverting 20260416000001"
npx supabase migration repair 20260416000001 --status reverted --linked
echo "[30/196] Reverting 20260416000002"
npx supabase migration repair 20260416000002 --status reverted --linked
echo "[31/196] Reverting 20260416000003"
npx supabase migration repair 20260416000003 --status reverted --linked
echo "[32/196] Reverting 20260416000004"
npx supabase migration repair 20260416000004 --status reverted --linked
echo "[33/196] Reverting 20260416000005"
npx supabase migration repair 20260416000005 --status reverted --linked
echo "[34/196] Reverting 20260416000006"
npx supabase migration repair 20260416000006 --status reverted --linked
echo "[35/196] Reverting 20260416000007"
npx supabase migration repair 20260416000007 --status reverted --linked
echo "[36/196] Reverting 20260416000008"
npx supabase migration repair 20260416000008 --status reverted --linked
echo "[37/196] Reverting 20260416000009"
npx supabase migration repair 20260416000009 --status reverted --linked
echo "[38/196] Reverting 20260416000010"
npx supabase migration repair 20260416000010 --status reverted --linked
echo "[39/196] Reverting 20260416000011"
npx supabase migration repair 20260416000011 --status reverted --linked
echo "[40/196] Reverting 20260416000012"
npx supabase migration repair 20260416000012 --status reverted --linked
echo "[41/196] Reverting 20260416000013"
npx supabase migration repair 20260416000013 --status reverted --linked
echo "[42/196] Reverting 20260416000014"
npx supabase migration repair 20260416000014 --status reverted --linked
echo "[43/196] Reverting 20260416000016"
npx supabase migration repair 20260416000016 --status reverted --linked
echo "[44/196] Reverting 20260416000017"
npx supabase migration repair 20260416000017 --status reverted --linked
echo "[45/196] Reverting 20260416000019"
npx supabase migration repair 20260416000019 --status reverted --linked
echo "[46/196] Reverting 20260417000000"
npx supabase migration repair 20260417000000 --status reverted --linked
echo "[47/196] Reverting 20260418000001"
npx supabase migration repair 20260418000001 --status reverted --linked
echo "[48/196] Reverting 20260418000002"
npx supabase migration repair 20260418000002 --status reverted --linked
echo "[49/196] Reverting 20260418000003"
npx supabase migration repair 20260418000003 --status reverted --linked
echo "[50/196] Reverting 20260420000001"
npx supabase migration repair 20260420000001 --status reverted --linked
echo "[51/196] Reverting 20260420000002"
npx supabase migration repair 20260420000002 --status reverted --linked
echo "[52/196] Reverting 20260420000003"
npx supabase migration repair 20260420000003 --status reverted --linked
echo "[53/196] Reverting 20260420000004"
npx supabase migration repair 20260420000004 --status reverted --linked
echo "[54/196] Reverting 20260420000005"
npx supabase migration repair 20260420000005 --status reverted --linked
echo "[55/196] Reverting 20260420000006"
npx supabase migration repair 20260420000006 --status reverted --linked
echo "[56/196] Reverting 20260420000007"
npx supabase migration repair 20260420000007 --status reverted --linked
echo "[57/196] Reverting 20260420000008"
npx supabase migration repair 20260420000008 --status reverted --linked
echo "[58/196] Reverting 20260420000009"
npx supabase migration repair 20260420000009 --status reverted --linked
echo "[59/196] Reverting 20260420000010"
npx supabase migration repair 20260420000010 --status reverted --linked
echo "[60/196] Reverting 20260420000011"
npx supabase migration repair 20260420000011 --status reverted --linked
echo "[61/196] Reverting 20260420000012"
npx supabase migration repair 20260420000012 --status reverted --linked
echo "[62/196] Reverting 20260420000013"
npx supabase migration repair 20260420000013 --status reverted --linked
echo "[63/196] Reverting 20260420000015"
npx supabase migration repair 20260420000015 --status reverted --linked
echo "[64/196] Reverting 20260420000016"
npx supabase migration repair 20260420000016 --status reverted --linked
echo "[65/196] Reverting 20260420000017"
npx supabase migration repair 20260420000017 --status reverted --linked
echo "[66/196] Reverting 20260420000020"
npx supabase migration repair 20260420000020 --status reverted --linked
echo "[67/196] Reverting 20260420000050"
npx supabase migration repair 20260420000050 --status reverted --linked
echo "[68/196] Reverting 20260420000060"
npx supabase migration repair 20260420000060 --status reverted --linked
echo "[69/196] Reverting 20260420000061"
npx supabase migration repair 20260420000061 --status reverted --linked
echo "[70/196] Reverting 20260420000062"
npx supabase migration repair 20260420000062 --status reverted --linked
echo "[71/196] Reverting 20260420000063"
npx supabase migration repair 20260420000063 --status reverted --linked
echo "[72/196] Reverting 20260420000064"
npx supabase migration repair 20260420000064 --status reverted --linked
echo "[73/196] Reverting 20260420000070"
npx supabase migration repair 20260420000070 --status reverted --linked
echo "[74/196] Reverting 20260420000071"
npx supabase migration repair 20260420000071 --status reverted --linked
echo "[75/196] Reverting 20260430000000"
npx supabase migration repair 20260430000000 --status reverted --linked
echo "[76/196] Reverting 20260430000001"
npx supabase migration repair 20260430000001 --status reverted --linked
echo "[77/196] Reverting 20260430000002"
npx supabase migration repair 20260430000002 --status reverted --linked
echo "[78/196] Reverting 20260430000003"
npx supabase migration repair 20260430000003 --status reverted --linked
echo "[79/196] Reverting 20260430000004"
npx supabase migration repair 20260430000004 --status reverted --linked
echo "[80/196] Reverting 20260430000005"
npx supabase migration repair 20260430000005 --status reverted --linked
echo "[81/196] Reverting 20260430000006"
npx supabase migration repair 20260430000006 --status reverted --linked
echo "[82/196] Reverting 20260430000007"
npx supabase migration repair 20260430000007 --status reverted --linked
echo "[83/196] Reverting 20260430000009"
npx supabase migration repair 20260430000009 --status reverted --linked
echo "[84/196] Reverting 20260430000010"
npx supabase migration repair 20260430000010 --status reverted --linked
echo "[85/196] Reverting 20260430000011"
npx supabase migration repair 20260430000011 --status reverted --linked
echo "[86/196] Reverting 20260430000012"
npx supabase migration repair 20260430000012 --status reverted --linked
echo "[87/196] Reverting 20260430000013"
npx supabase migration repair 20260430000013 --status reverted --linked
echo "[88/196] Reverting 20260430000014"
npx supabase migration repair 20260430000014 --status reverted --linked
echo "[89/196] Reverting 20260430000015"
npx supabase migration repair 20260430000015 --status reverted --linked
echo "[90/196] Reverting 20260430000016"
npx supabase migration repair 20260430000016 --status reverted --linked
echo "[91/196] Reverting 20260430000017"
npx supabase migration repair 20260430000017 --status reverted --linked
echo "[92/196] Reverting 20260430000018"
npx supabase migration repair 20260430000018 --status reverted --linked
echo "[93/196] Reverting 20260430000019"
npx supabase migration repair 20260430000019 --status reverted --linked
echo "[94/196] Reverting 20260430000020"
npx supabase migration repair 20260430000020 --status reverted --linked
echo "[95/196] Reverting 20260430000021"
npx supabase migration repair 20260430000021 --status reverted --linked
echo "[96/196] Reverting 20260430000022"
npx supabase migration repair 20260430000022 --status reverted --linked
echo "[97/196] Reverting 20260430000023"
npx supabase migration repair 20260430000023 --status reverted --linked
echo "[98/196] Reverting 20260430000024"
npx supabase migration repair 20260430000024 --status reverted --linked
echo "[99/196] Reverting 20260430000025"
npx supabase migration repair 20260430000025 --status reverted --linked
echo "[100/196] Reverting 20260430000026"
npx supabase migration repair 20260430000026 --status reverted --linked
echo "[101/196] Reverting 20260501000001"
npx supabase migration repair 20260501000001 --status reverted --linked
echo "[102/196] Reverting 20260501000002"
npx supabase migration repair 20260501000002 --status reverted --linked
echo "[103/196] Reverting 20260501000003"
npx supabase migration repair 20260501000003 --status reverted --linked
echo "[104/196] Reverting 20260501000004"
npx supabase migration repair 20260501000004 --status reverted --linked
echo "[105/196] Reverting 20260501000005"
npx supabase migration repair 20260501000005 --status reverted --linked
echo "[106/196] Reverting 20260501000006"
npx supabase migration repair 20260501000006 --status reverted --linked
echo "[107/196] Reverting 20260501000007"
npx supabase migration repair 20260501000007 --status reverted --linked
echo "[108/196] Reverting 20260501000008"
npx supabase migration repair 20260501000008 --status reverted --linked
echo "[109/196] Reverting 20260501000009"
npx supabase migration repair 20260501000009 --status reverted --linked
echo "[110/196] Reverting 20260501000010"
npx supabase migration repair 20260501000010 --status reverted --linked
echo "[111/196] Reverting 20260501000011"
npx supabase migration repair 20260501000011 --status reverted --linked
echo "[112/196] Reverting 20260501000012"
npx supabase migration repair 20260501000012 --status reverted --linked
echo "[113/196] Reverting 20260501000013"
npx supabase migration repair 20260501000013 --status reverted --linked
echo "[114/196] Reverting 20260501000014"
npx supabase migration repair 20260501000014 --status reverted --linked
echo "[115/196] Reverting 20260501000015"
npx supabase migration repair 20260501000015 --status reverted --linked
echo "[116/196] Reverting 20260501000016"
npx supabase migration repair 20260501000016 --status reverted --linked
echo "[117/196] Reverting 20260501000017"
npx supabase migration repair 20260501000017 --status reverted --linked
echo "[118/196] Reverting 20260501000018"
npx supabase migration repair 20260501000018 --status reverted --linked
echo "[119/196] Reverting 20260501000019"
npx supabase migration repair 20260501000019 --status reverted --linked
echo "[120/196] Reverting 20260501000020"
npx supabase migration repair 20260501000020 --status reverted --linked
echo "[121/196] Reverting 20260501000021"
npx supabase migration repair 20260501000021 --status reverted --linked
echo "[122/196] Reverting 20260501000022"
npx supabase migration repair 20260501000022 --status reverted --linked
echo "[123/196] Reverting 20260501000023"
npx supabase migration repair 20260501000023 --status reverted --linked
echo "[124/196] Reverting 20260501000024"
npx supabase migration repair 20260501000024 --status reverted --linked
echo "[125/196] Reverting 20260501000025"
npx supabase migration repair 20260501000025 --status reverted --linked
echo "[126/196] Reverting 20260501000026"
npx supabase migration repair 20260501000026 --status reverted --linked
echo "[127/196] Reverting 20260501000027"
npx supabase migration repair 20260501000027 --status reverted --linked
echo "[128/196] Reverting 20260501000028"
npx supabase migration repair 20260501000028 --status reverted --linked
echo "[129/196] Reverting 20260501100000"
npx supabase migration repair 20260501100000 --status reverted --linked
echo "[130/196] Reverting 20260501100001"
npx supabase migration repair 20260501100001 --status reverted --linked
echo "[131/196] Reverting 20260501100002"
npx supabase migration repair 20260501100002 --status reverted --linked
echo "[132/196] Reverting 20260501100003"
npx supabase migration repair 20260501100003 --status reverted --linked
echo "[133/196] Reverting 20260501100004"
npx supabase migration repair 20260501100004 --status reverted --linked
echo "[134/196] Reverting 20260501100005"
npx supabase migration repair 20260501100005 --status reverted --linked
echo "[135/196] Reverting 20260501100006"
npx supabase migration repair 20260501100006 --status reverted --linked
echo "[136/196] Reverting 20260501100007"
npx supabase migration repair 20260501100007 --status reverted --linked
echo "[137/196] Reverting 20260501100008"
npx supabase migration repair 20260501100008 --status reverted --linked
echo "[138/196] Reverting 20260501100009"
npx supabase migration repair 20260501100009 --status reverted --linked
echo "[139/196] Reverting 20260501100010"
npx supabase migration repair 20260501100010 --status reverted --linked
echo "[140/196] Reverting 20260501100011"
npx supabase migration repair 20260501100011 --status reverted --linked
echo "[141/196] Reverting 20260501100012"
npx supabase migration repair 20260501100012 --status reverted --linked
echo "[142/196] Reverting 20260501100013"
npx supabase migration repair 20260501100013 --status reverted --linked
echo "[143/196] Reverting 20260501100014"
npx supabase migration repair 20260501100014 --status reverted --linked
echo "[144/196] Reverting 20260501100015"
npx supabase migration repair 20260501100015 --status reverted --linked
echo "[145/196] Reverting 20260501100016"
npx supabase migration repair 20260501100016 --status reverted --linked
echo "[146/196] Reverting 20260501100017"
npx supabase migration repair 20260501100017 --status reverted --linked
echo "[147/196] Reverting 20260501100018"
npx supabase migration repair 20260501100018 --status reverted --linked
echo "[148/196] Reverting 20260501100020"
npx supabase migration repair 20260501100020 --status reverted --linked
echo "[149/196] Reverting 20260501100021"
npx supabase migration repair 20260501100021 --status reverted --linked
echo "[150/196] Reverting 20260501100022"
npx supabase migration repair 20260501100022 --status reverted --linked
echo "[151/196] Reverting 20260501100023"
npx supabase migration repair 20260501100023 --status reverted --linked
echo "[152/196] Reverting 20260501100024"
npx supabase migration repair 20260501100024 --status reverted --linked
echo "[153/196] Reverting 20260501100025"
npx supabase migration repair 20260501100025 --status reverted --linked
echo "[154/196] Reverting 20260501100026"
npx supabase migration repair 20260501100026 --status reverted --linked
echo "[155/196] Reverting 20260502000001"
npx supabase migration repair 20260502000001 --status reverted --linked
echo "[156/196] Reverting 20260502000002"
npx supabase migration repair 20260502000002 --status reverted --linked
echo "[157/196] Reverting 20260502000003"
npx supabase migration repair 20260502000003 --status reverted --linked
echo "[158/196] Reverting 20260503000001"
npx supabase migration repair 20260503000001 --status reverted --linked
echo "[159/196] Reverting 20260503000002"
npx supabase migration repair 20260503000002 --status reverted --linked
echo "[160/196] Reverting 20260503000003"
npx supabase migration repair 20260503000003 --status reverted --linked
echo "[161/196] Reverting 20260503000004"
npx supabase migration repair 20260503000004 --status reverted --linked
echo "[162/196] Reverting 20260503000005"
npx supabase migration repair 20260503000005 --status reverted --linked
echo "[163/196] Reverting 20260503000006"
npx supabase migration repair 20260503000006 --status reverted --linked
echo "[164/196] Reverting 20260503000007"
npx supabase migration repair 20260503000007 --status reverted --linked
echo "[165/196] Reverting 20260503000008"
npx supabase migration repair 20260503000008 --status reverted --linked
echo "[166/196] Reverting 20260503000009"
npx supabase migration repair 20260503000009 --status reverted --linked
echo "[167/196] Reverting 20260504000001"
npx supabase migration repair 20260504000001 --status reverted --linked
echo "[168/196] Reverting 20260504000002"
npx supabase migration repair 20260504000002 --status reverted --linked
echo "[169/196] Reverting 20260504000003"
npx supabase migration repair 20260504000003 --status reverted --linked
echo "[170/196] Reverting 20260504000004"
npx supabase migration repair 20260504000004 --status reverted --linked
echo "[171/196] Reverting 20260504000005"
npx supabase migration repair 20260504000005 --status reverted --linked
echo "[172/196] Reverting 20260504000006"
npx supabase migration repair 20260504000006 --status reverted --linked
echo "[173/196] Reverting 20260504100001"
npx supabase migration repair 20260504100001 --status reverted --linked
echo "[174/196] Reverting 20260504100002"
npx supabase migration repair 20260504100002 --status reverted --linked
echo "[175/196] Reverting 20260504100003"
npx supabase migration repair 20260504100003 --status reverted --linked
echo "[176/196] Reverting 20260505000001"
npx supabase migration repair 20260505000001 --status reverted --linked
echo "[177/196] Reverting 20260505000002"
npx supabase migration repair 20260505000002 --status reverted --linked
echo "[178/196] Reverting 20260505000003"
npx supabase migration repair 20260505000003 --status reverted --linked
echo "[179/196] Reverting 20260505000004"
npx supabase migration repair 20260505000004 --status reverted --linked
echo "[180/196] Reverting 20260505000005"
npx supabase migration repair 20260505000005 --status reverted --linked
echo "[181/196] Reverting 20260505100001"
npx supabase migration repair 20260505100001 --status reverted --linked
echo "[182/196] Reverting 20260505100002"
npx supabase migration repair 20260505100002 --status reverted --linked
echo "[183/196] Reverting 20260505100003"
npx supabase migration repair 20260505100003 --status reverted --linked
echo "[184/196] Reverting 20260506000001"
npx supabase migration repair 20260506000001 --status reverted --linked
echo "[185/196] Reverting 20260506000002"
npx supabase migration repair 20260506000002 --status reverted --linked
echo "[186/196] Reverting 20260506000003"
npx supabase migration repair 20260506000003 --status reverted --linked
echo "[187/196] Reverting 20260506000004"
npx supabase migration repair 20260506000004 --status reverted --linked
echo "[188/196] Reverting 20260506000005"
npx supabase migration repair 20260506000005 --status reverted --linked
echo "[189/196] Reverting 20260506000006"
npx supabase migration repair 20260506000006 --status reverted --linked
echo "[190/196] Reverting 20260506000007"
npx supabase migration repair 20260506000007 --status reverted --linked
echo "[191/196] Reverting 20260506000008"
npx supabase migration repair 20260506000008 --status reverted --linked
echo "[192/196] Reverting 20260506000010"
npx supabase migration repair 20260506000010 --status reverted --linked
echo "[193/196] Reverting 20260506000011"
npx supabase migration repair 20260506000011 --status reverted --linked
echo "[194/196] Reverting 20260506000012"
npx supabase migration repair 20260506000012 --status reverted --linked
echo "[195/196] Reverting 20260506000013"
npx supabase migration repair 20260506000013 --status reverted --linked
echo "[196/196] Reverting 20260506000014"
npx supabase migration repair 20260506000014 --status reverted --linked

echo ""
echo "Marking 4 new migrations as applied..."
echo "Applying 20260507000001"
npx supabase migration repair 20260507000001 --status applied --linked
echo "Applying 20260507000002"
npx supabase migration repair 20260507000002 --status applied --linked
echo "Applying 20260507000003"
npx supabase migration repair 20260507000003 --status applied --linked
echo "Applying 20260507000004"
npx supabase migration repair 20260507000004 --status applied --linked

echo ""
echo "Done! Verify with: npx supabase migration list --linked"
