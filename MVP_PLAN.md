# Dotify, plan MVP testnet public

Date de rédaction : 2026-05-03
Mise à jour : 2026-05-04
Cible : MVP utilisable par de vrais artistes et auditeurs sur Paseo Asset Hub.
Auteur : analyse menée à partir du code dans `Dotify/contracts/evm/` et `Dotify/web/`.

## Mise à jour du 2026-05-04

Le point bloquant "absence totale d'enforcement de l'accès" a été partiellement
traité côté frontend :

- les auditeurs sont vérifiés via `musicAccCanAccess(contentHash, listener)`
  avant chargement de la piste ;
- les pistes enregistrées sont stockées sur IPFS sous forme chiffrée
  (`dotify:enc:ipfs://CID`) ;
- si le compte ne satisfait pas les règles Human free ou Classic, l'app génère
  une source audio séparée limitée à 42% de la durée et affiche un message
  indiquant l'action requise pour débloquer la piste complète ;
- les lectures IPFS utilisent maintenant une liste de gateways de fallback pour
  éviter qu'une gateway Pinata authentifiée ne bloque les manifests ou les
  fichiers chiffrés avec un `401`.

Ce changement améliore la cohérence du MVP, mais reste une protection
best-effort côté client. Le secret de dérivation peut encore être embarqué dans
le bundle frontend (`VITE_CONTENT_SECRET`) et ne doit pas être considéré comme
une frontière DRM production. Les sections ci-dessous restent donc valables pour
la trajectoire MVP : key service, vraie intégration wallet, registrar personhood
partagé et tests frontend restent nécessaires.

## 1. Résumé exécutif

Dotify est aujourd'hui un prototype solide sur la couche on-chain (Smart Runtime par artiste, registre de pistes, royalties on-chain, NFT de droits, levels de personhood) et un frontend React qui couvre la création artiste, la publication de pistes, le streaming WebRTC et la lecture depuis IPFS. La logique de royalties et de NFT est testée côté contrats.

Pour devenir un MVP testnet cohérent, trois écarts critiques doivent être comblés :

1. **L'accès aux pistes n'est pas réellement protégé.** Les modes `Classic` (paiement) et `HumanFree` (proof-of-personhood) sont enregistrés on-chain mais le frontend ne les vérifie pas et ne les applique pas. Un fichier audio publié reste accessible publiquement via la gateway IPFS pour n'importe quelle adresse.
2. **Deux registres concurrents coexistent dans le code.** `MusicRightsRegistry.sol` (monolithique) et la suite de pallets `MusicRegistry/NFT/Royalties/Access` (Diamond) implémentent quasiment la même logique. Le frontend n'utilise que la version pallet, mais le contrat monolithique est compilé, déployable et risque d'introduire de la confusion en production.
3. **Le rôle de personhood-registrar est aujourd'hui occupé par l'artiste.** En l'état, chaque artiste doit appeler manuellement `musicAccSetPersonhoodLevel` pour chaque auditeur qui veut accéder à ses pistes HumanFree. C'est inutilisable pour un public testnet.

Le reste du document détaille l'état actuel, propose un modèle de protection des musiques cohérent avec l'architecture existante, et donne une feuille de route priorisée pour atteindre le MVP.

## 2. État actuel

### 2.1 Côté contrats (Dotify/contracts/evm/)

Architecture de référence (pallet Diamond), entièrement testée dans `test/ArtistRuntime.test.ts` :

- `ArtistDirectory.sol` : registre global artiste → adresse de SmartRuntime, écrit uniquement par la factory.
- `ArtistRuntimeFactory.sol` : déploie un `SmartRuntime` par artiste, attache 7 pallets (3 core + 4 musique), enregistre dans le directory.
- `DotifyRuntimeInitializer.sol` : `delegatecall`-é pendant le constructeur, fixe le personhood-registrar à l'artiste.
- Pallets musique :
  - `MusicRegistryPallet` : `musicRegRegister`, `musicRegDeactivate`, vues sur les pistes.
  - `MusicNFTPallet` : NFT ERC-721-like représentant les droits de l'artiste (transfert gaté par personhood pour les pistes HumanFree).
  - `MusicRoyaltiesPallet` : `musicRoyPayAccess` (mode Classic, déclenche split + écrit `paidAccess`), `musicRoyRecordListen` (HumanFree, hook analytics).
  - `MusicAccessPallet` : `musicAccCanAccess`, `musicAccHasPaid`, gestion personhood.
- Bibliothèques de stockage Diamond namespacées : `LibMusicRegistry`, `LibMusicNFT`, `LibMusicRoyalties`, `LibMusicAccess`.
- Royalties : `LibMusicRoyalties.distribute` pousse natif aux bénéficiaires, le reliquat va à l'artiste.

Code legacy en parallèle :

- `MusicRightsRegistry.sol` + `LibDotify.sol` : implémentation monolithique antérieure. Couvre les mêmes responsabilités. **Non utilisée par le frontend** (aucune référence dans `web/src/config/contracts.ts`) mais toujours compilée et présente dans le pipeline de déploiement.

### 2.2 Côté frontend (Dotify/web/src/)

Application React mono-fichier de grosse taille (`App.tsx` autour de 2200 lignes) qui couvre :

- **Création artiste** : appel `factory.createRuntime`, suivi via `directory.runtimeOf`, statut affiché dans Artist Studio.
- **Publication d'une piste** :
  1. Hash blake2b-256 du fichier audio en local (`utils/hash.ts`).
  2. Upload IPFS audio + cover via Pinata (`services/pinata.ts`).
  3. Upload du manifeste JSON via Pinata, puis optionnellement publication sur Bulletin Chain (`hooks/useBulletin.ts`).
  4. Appel `runtime.musicRegRegister` avec `accessMode`, `pricePlanck` ou `requiredPersonhood`.
- **Catalogue** : itère sur `artistsPage` du directory, lit chaque runtime via `musicRegTrackCount` + `musicRegGetTrack`, agrège un catalogue trié par bloc.
- **Listening rooms** : signaling Socket.IO (`server/signaling.mjs`), WebRTC peer-to-peer host → listeners avec `captureStream` sur l'élément audio.
- **Lecteur** : `resolveAudioAssetRef` traduit `ipfs://CID` en URL gateway publique (`paseo-ipfs.polkadot.io`) et l'attache directement à un `<audio>` HTML.
- **Build IPFS-friendly** : `vite.bulletin.config.ts` construit un seul fichier HTML pour distribution Bulletin / DotNS.

Ce qui existe dans le code mais n'est **pas branché** :

- `utils/crypto.ts` (chiffrement AES-256-GCM) : importé nulle part en dehors du fichier lui-même.
- `hooks/useLocalAssets.ts` (stockage chiffré local possible via flag `encrypted`) : non appelé.
- `musicAccCanAccess`, `musicRoyPayAccess`, `musicAccSetPersonhoodLevel`, `musicRoyRecordListen` : ABI exportés dans `config/contracts.ts` mais aucun appel depuis `App.tsx`.

### 2.3 Tests

- `Dotify/contracts/evm/test/ArtistRuntime.test.ts` couvre déploiement complet, création runtime, register, deactivate, payAccess + distribution, canAccess avec personhood, transferts NFT, isolation entre artistes, upgrade forkless. C'est la zone la plus saine du projet.
- `Dotify/contracts/evm/test/MusicRightsRegistry.test.ts` couvre le contrat legacy.
- Aucun test côté frontend.

### 2.4 Déploiements live (Paseo Asset Hub, chainId 420420417)

Adresses captées dans `web/src/config/deployments.ts`. La factory et le directory sont en ligne, les 7 pallets sont déployés. La distribution web vit aussi sur Bulletin (`dotify.dot.li`).

## 3. Modèle de protection des musiques

### 3.1 Diagnostic

Le contrat `MusicAccessPallet.musicAccCanAccess` retourne bien `true` ou `false` selon le mode :

- `Classic` : vrai si `paidAccess[contentHash][listener]` a été écrit par `musicRoyPayAccess`.
- `HumanFree` : vrai si `personhoodLevelOf[listener] >= requiredPersonhood`.
- Toujours vrai pour l'artiste original et pour le détenteur courant du NFT.

Mais cette autorisation reste purement déclarative. Dans le frontend, `resolveAudioAssetRef` se contente de transformer la référence `ipfs://CID` en URL HTTP de gateway, et le `<audio>` la lit directement. N'importe quel auditeur, même non-vérifié pour HumanFree ou non-payeur pour Classic, peut :

1. Ouvrir le catalogue (lectures publiques).
2. Récupérer le `audioRef` dans la `TrackRecord`.
3. Charger directement la gateway publique sans passer par le runtime.

Le code de chiffrement existe (`utils/crypto.ts`) mais n'est pas câblé. Conséquence : pour un MVP public, la promesse "rights-managed streaming" n'est pas tenue. C'est aussi un risque réputationnel pour les artistes qui publieraient leurs masters.

### 3.2 Modèle proposé pour le MVP

L'objectif est de coller au modèle Diamond existant sans introduire de nouvelle infrastructure complexe. Trois variantes sont possibles, par ordre de complexité croissante.

**Option A, baseline pour MVP testnet : chiffrement client + remise de clé via signature artiste.**

- À l'upload, le frontend génère une `contentKey` aléatoire (déjà disponible via `generateContentKey` dans `utils/crypto.ts`), chiffre l'audio en AES-256-GCM, pousse le `ciphertext` sur IPFS, conserve la `contentKey` côté artiste (chiffrée localement avec un secret dérivé de la wallet de l'artiste, ou simplement stockée sur Bulletin chiffrée par la clé publique de l'artiste).
- À la lecture, l'auditeur appelle d'abord `musicAccCanAccess(contentHash, listenerAddr)`. S'il retourne `true`, il signe un challenge avec sa wallet. L'artiste (ou un service délégué) vérifie la signature, vérifie `canAccess` on-chain, et renvoie la `contentKey` chiffrée pour la clé publique de l'auditeur.
- L'auditeur déchiffre la clé, récupère le ciphertext IPFS, le déchiffre dans le browser, le joue.

Avantages : utilise tout ce qui existe (`crypto.ts`, ABI access, royalties), aucune infra serveur dédiée requise pour la baseline (l'artiste peut être online pour la première version). Limite : si l'artiste est offline, les nouvelles pistes ne sont pas écoutables. Pour le MVP testnet c'est tolérable.

**Option B, intermédiaire : key-server signé par l'artiste.**

- L'artiste héberge (ou délègue) un petit "Key Service" (Node ou worker) qui possède la `contentKey` et expose un endpoint qui :
  1. Vérifie la signature de l'auditeur sur un nonce frais.
  2. Vérifie via `musicAccCanAccess` on-chain que l'auditeur est autorisé.
  3. Renvoie la clé chiffrée pour la pubkey de l'auditeur.
- Compatible avec la distribution Bulletin / IPFS du frontend (le service est externe).

Avantages : disponibilité 24/7, pas besoin que l'artiste soit en ligne. Limite : centralisation par artiste, mais acceptable pour un MVP, et assumé par la doctrine "artist-controlled".

**Option C, cible long terme : threshold encryption (Lit, NuCypher PRE, ou DKG dédié sur Polkadot).**

À garder hors-périmètre MVP. Mentionné ici uniquement pour fixer la trajectoire.

### 3.3 Recommandation

Cibler **Option A pour la première itération MVP**, avec un design d'API qui rend l'évolution vers Option B mécanique. Concrètement :

- Wrapper `getContentKeyForListener(contentHash)` côté frontend, qui appelle d'abord `musicAccCanAccess` puis tente la résolution via une stratégie pluggable (artiste online aujourd'hui, key service demain).
- Manifeste IPFS étendu avec un champ `assets.audioCID` pointant vers le ciphertext et un champ `assets.encrypted: true` + `crypto: { algo: 'AES-256-GCM', keyDelivery: 'artist-signed' }`.
- Côté UX, état du player explicite : "Locked, requires payment", "Locked, requires DIM1 verification", "Unlocking", "Playing".

### 3.4 Mode HumanFree et personhood-registrar

Avec le registrar fixé sur l'artiste par `DotifyRuntimeInitializer`, le mode HumanFree est inutilisable à l'échelle du MVP : chaque artiste devrait constater manuellement la personhood de chaque auditeur. Trois approches possibles :

1. **Registrar partagé géré par Dotify** : un compte opéré par l'équipe Dotify est désigné registrar pour tous les runtimes nouvellement créés. C'est le plus simple à mettre en place, mais retire l'agentivité de l'artiste. Acceptable pour un testnet public si bien documenté.
2. **Registrar par défaut = service externe Individuality Chain** : un oracle Dotify lit l'Individuality Chain et propage les niveaux DIM. Aligne avec l'intention dans les commentaires (`MusicAccessPallet.sol` ligne 17 à 21) mais ajoute une dépendance.
3. **Manuel artiste, conservation actuelle** : exclu pour le MVP testnet, mais on peut l'exposer dans une page d'admin pour les artistes early adopter.

Recommandation MVP : approche 1 avec un compte multisig Dotify, exposé dans la doc, et migration ultérieure vers approche 2.

## 4. Parcours utilisateur cibles

Pour un MVP cohérent, deux parcours utilisateur doivent être vraiment fonctionnels de bout en bout, sans contournement.

### 4.1 Parcours artiste

1. Connecte sa wallet (au-delà des dev-keys hardcodées de `evmDevAccounts`).
2. Crée son SmartRuntime via `factory.createRuntime`, voit la confirmation, peut consulter son adresse de runtime sur Blockscout.
3. Upload une piste : choisit un fichier audio, le frontend hashe + chiffre + pousse le ciphertext sur IPFS.
4. Choisit un mode d'accès (Classic ou HumanFree), un prix ou un niveau DIM, configure les bénéficiaires de royalties.
5. Publie le manifeste, signe la transaction `musicRegRegister`, voit la confirmation et la piste apparaître dans son catalogue.
6. Voit ses statistiques : nombre de paiements reçus, somme distribuée, listenRecorded sur HumanFree.

### 4.2 Parcours auditeur

1. Connecte sa wallet, le frontend résout son niveau de personhood.
2. Parcourt le catalogue agrégé depuis le directory + les runtimes.
3. Sélectionne une piste :
   - Mode Classic : voit le prix, clique "Pay 0.5 DOT", signe `musicRoyPayAccess`, le frontend attend la confirmation puis débloque la lecture.
   - Mode HumanFree : voit "Requires DIM1 verification". Si la personhood est suffisante, la lecture est débloquée et `musicRoyRecordListen` est appelé en arrière-plan.
4. Le frontend récupère la `contentKey`, télécharge le ciphertext, le déchiffre, lance la lecture.
5. Optionnellement, l'auditeur ouvre une listening room et invite des pairs (qui doivent eux aussi être autorisés).

### 4.3 Listening rooms

La fonction WebRTC est déjà implémentée et marche en local. Pour le MVP testnet :

- Le serveur de signaling `server/signaling.mjs` doit être hébergé (port 8788) et joignable depuis le build Bulletin / DotNS. C'est un blocage opérationnel, pas technique.
- Le host doit être autorisé pour la piste qu'il diffuse (sinon la stream WebRTC contourne le contrôle d'accès on-chain). À ajouter dans `prepareLocalStream` : check `musicAccCanAccess(track.hash, hostAddr)`.
- Optionnel pour cette itération : exiger l'autorisation auditeur côté listener avant `acceptOffer`.

## 5. Risques et blocages

### 5.1 Bloquants pour la livraison MVP testnet

1. **Absence d'enforcement de l'accès** (cf. section 3) : sans cela, le produit ne tient pas sa promesse.
2. **Personhood-registrar fixé à l'artiste** : empêche tout déploiement HumanFree à l'échelle.
3. **Wallet integration absente** : `App.tsx` n'utilise que les comptes Alice/Bob hardcodés (`evmDevAccounts` dans `config/contracts.ts` ligne 352). Aucun adapter MetaMask, WalletConnect, Talisman, ou injection EIP-6963. Pour un testnet public, c'est rédhibitoire.
4. **Signaling server non hébergé** : la build Bulletin n'a pas de serveur WebRTC déployé connu. Sans cela, listening rooms cassent dès qu'on quitte localhost.
5. **Dépendance Pinata JWT exposé côté client** (`VITE_PINATA_JWT`) : un compte Pinata partagé en prod est risqué. Soit limiter le scope du JWT et accepter la dépense, soit médiatiser l'upload via un proxy.

### 5.2 Risques importants mais non bloquants

- **Deux implémentations concurrentes** (`MusicRightsRegistry.sol` vs pallets) : à supprimer ou à archiver clairement avant un audit. Le code legacy n'est plus utilisé par le frontend mais reste dans la suite de tests et le build.
- **Aucun test frontend** : changement risqué chaque fois qu'on touche à `App.tsx`. Au minimum quelques tests d'intégration sur le flux d'enregistrement et de paiement.
- **`App.tsx` monolithique** (~2200 lignes) : refactor en hooks et composants ciblés simplifierait beaucoup les évolutions à venir, surtout avec l'ajout du chiffrement et du wallet.
- **Métadonnées Bulletin optionnelles** : si Bulletin est down, le manifeste reste sur IPFS. À documenter clairement comme stratégie volontaire de redondance, ou rendre obligatoire pour les pistes "officielles".
- **Tests payAccess non couverts en intégration frontend** : la pile complète paiement → distribution → unlock n'est jamais exercée bout-en-bout aujourd'hui.

### 5.3 Dette technique à programmer

- Suppression ou archivage de `MusicRightsRegistry.sol` + `LibDotify.sol` + `MusicRightsRegistry.test.ts`.
- Découpage de `App.tsx` en sous-modules : `studio/`, `catalog/`, `player/`, `rooms/`, `wallet/`.
- Sortir les ABI inline de `config/contracts.ts` vers des fichiers générés à partir des artefacts Hardhat (cohérence garantie).
- Centraliser la résolution d'asset (audio, cover) dans un service unique avec fallback gateway et gestion d'erreur.

## 6. Roadmap priorisée

Trois phases, chacune livrable séparément.

### Phase 1, fondations utilisables (1 à 2 sprints)

Objectif : un utilisateur public peut connecter sa wallet, payer, écouter une piste protégée.

- [P1.1] Intégration wallet : injection EIP-6963 (Talisman, MetaMask), retirer les dev-keys de la prod, garder un mode "demo" pour local.
- [P1.2] Chiffrement à l'upload : brancher `encryptAudio` dans le pipeline `handleAudioFile` + `registerRights`. Manifeste mis à jour avec `crypto.algo` et `crypto.keyDelivery`.
- [P1.3] Déchiffrement à la lecture : nouveau hook `useTrackUnlock(track, listenerAddr)` qui appelle `musicAccCanAccess` puis récupère la clé.
- [P1.4] Paiement Classic : bouton "Unlock for X DOT" qui appelle `musicRoyPayAccess`, attend le receipt, puis débloque le déchiffrement.
- [P1.5] Personhood-registrar Dotify : un compte multisig Dotify devient registrar par défaut. UI artiste pour le réassigner s'il le souhaite.
- [P1.6] Hébergement du signaling server : déploiement publique du `server/signaling.mjs` ou migration vers un service géré.
- [P1.7] Hosting du build Bulletin avec env de prod (URL signaling, RPC testnet, Pinata JWT à scope minimal).

Critère de succès : enregistrer une piste depuis un poste, l'écouter depuis un autre via une wallet tierce, après paiement réel sur testnet.

### Phase 2, qualité produit et confiance (2 à 3 sprints)

Objectif : produit utilisable par de vrais artistes pour leurs releases test.

- [P2.1] HumanFree de bout en bout : oracle de personhood (manuel ou Individuality Chain), UI listener pour visualiser son niveau et demander une vérification.
- [P2.2] Tableau de bord artiste : revenus reçus, paiements par piste, top auditeurs, listenRecorded.
- [P2.3] Refacto `App.tsx` en composants par parcours (studio, catalog, player, rooms).
- [P2.4] Suppression du code legacy (`MusicRightsRegistry.sol` et fichiers liés) ou rebrandage clair en dépôt d'archive.
- [P2.5] Tests d'intégration frontend (Playwright ou Vitest + msw) sur le flux paiement et unlock.
- [P2.6] Audit interne des pallets musique avant un usage testnet à plus large échelle.

Critère de succès : trois artistes externes publient au moins deux pistes chacun et reçoivent des paiements testnet.

### Phase 3, listening rooms gated et préparation production (à programmer après Phase 2)

- [P3.1] Listening rooms gated : check d'accès host et listener sur la piste, refus serveur côté signaling si non-autorisé.
- [P3.2] Stratégie key delivery industrialisée : key-server par artiste ou délégué Dotify, avec spec API stable.
- [P3.3] Migration vers un mode mainnet sur Polkadot Hub (post-Paseo) avec audit externe.
- [P3.4] Préparation à threshold encryption pour une vraie décentralisation de la livraison de clé.

## 7. Décisions ouvertes à arbitrer

Avant de démarrer la Phase 1, trois décisions doivent être prises :

1. **Politique personhood-registrar pour le MVP** : registrar Dotify par défaut, ou laisser l'artiste choisir entre auto-gestion et délégation Dotify ?
2. **Stratégie de livraison de clé Phase 1** : artiste online (simple, mais SLA dépend de l'artiste) ou un mini key-service Dotify dès le début (plus de code à livrer mais SLA Dotify) ?
3. **Sort du contrat legacy `MusicRightsRegistry.sol`** : suppression immédiate, archivage dans un dossier `legacy/`, ou maintien tant qu'aucun audit n'a validé la suite pallet ?

## 8. Annexe : références code clés

| Sujet | Fichier | Notes |
| --- | --- | --- |
| Création runtime artiste | `Dotify/contracts/evm/contracts/ArtistRuntimeFactory.sol` | Fixe le registrar à l'artiste via `DotifyRuntimeInitializer` |
| Logique d'accès | `Dotify/contracts/evm/contracts/pallets/MusicAccessPallet.sol` | `musicAccCanAccess` est la source de vérité on-chain |
| Paiement et split | `Dotify/contracts/evm/contracts/pallets/MusicRoyaltiesPallet.sol` | Distribue à la transaction, reliquat à l'artiste |
| Frontend studio + lecture | `Dotify/web/src/App.tsx` | Mono-fichier, sans appel au pallet d'accès aujourd'hui |
| Crypto disponible non branchée | `Dotify/web/src/utils/crypto.ts` | AES-256-GCM, format `nonce(12) \|\| ciphertext` |
| Pinata IPFS | `Dotify/web/src/services/pinata.ts` | JWT lu depuis `VITE_PINATA_JWT` |
| Bulletin Chain | `Dotify/web/src/hooks/useBulletin.ts` | Limite 8 MiB, autorisation account-bound |
| Tests on-chain | `Dotify/contracts/evm/test/ArtistRuntime.test.ts` | Couverture du flux complet pallet, à utiliser comme référence |
| Code legacy | `Dotify/contracts/evm/contracts/MusicRightsRegistry.sol` | À archiver |
| Déploiements live | `Dotify/web/src/config/deployments.ts` | Adresses Paseo Asset Hub |
