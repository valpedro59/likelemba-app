# Functional Requirements Document (FRD) : Likelemba-app

> Version 1. Complète le PRD (le quoi et le pourquoi) et le TRD (le comment technique) : ce document liste ce que le système **doit faire** (exigences fonctionnelles) et **avec quelle qualité** (exigences non fonctionnelles), de façon vérifiable.
>
> Les cibles chiffrées des exigences non fonctionnelles sont des **propositions** à ajuster. Les points marqués **[À valider]** sont des décisions métier à confirmer.

## 0. Conventions

**Priorité (MoSCoW)** : **M** = obligatoire pour la v1, **S** = souhaitable, **C** = si le temps le permet.

**Statut** : **Fait** = implémenté, **À tester** = écrit mais pas encore testé de bout en bout, **À faire** = pas commencé.

**Identifiants** : `FR-<module>-<n>` pour les exigences fonctionnelles, `RM-<n>` pour les règles métier, `NFR-<catégorie>-<n>` pour les exigences non fonctionnelles.

## 1. Introduction

### 1.1 Objet

Likelemba-app digitalise la gestion des tontines : création de groupes, ordre de passage, calendrier, collecte des cotisations et distribution de la cagnotte par Mobile Money (MTN, Airtel via Pawapay), avec rappels automatiques.

### 1.2 Acteurs

| Acteur                     | Description                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| Visiteur                   | Personne non connectée (page d'accueil, aperçu d'une invitation)                           |
| Membre                     | Utilisateur connecté, membre d'au moins un groupe                                          |
| Administrateur de groupe   | Membre qui a créé le groupe et le gère                                                     |
| Pawapay                    | Système externe : exécute les prélèvements et les envois Mobile Money, envoie des webhooks |
| Fournisseur SMS / WhatsApp | Système externe : envoie les codes OTP et les rappels                                      |
| Planificateur              | Tâches automatiques (rappels, réconciliation)                                              |

### 1.3 Glossaire

- **Cycle (tour)** : une période de cotisation au bout de laquelle un membre reçoit la cagnotte.
- **Cotisation (contribution)** : montant dû par un membre pour un cycle donné.
- **Cagnotte** : somme des cotisations d'un cycle, versée au bénéficiaire.
- **Payout** : le versement de la cagnotte au bénéficiaire.
- **Ordre de passage** : l'ordre dans lequel les membres reçoivent la cagnotte.

## 2. Exigences fonctionnelles

### 2.1 Authentification et compte (AUTH)

| ID         | Exigence                                                                                                                      | Prio | Statut                     |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------- | ---- | -------------------------- |
| FR-AUTH-01 | Le visiteur peut s'inscrire en fournissant nom complet, numéro de téléphone (+242) et opérateur Mobile Money (MTN ou Airtel). | M    | Fait                       |
| FR-AUTH-02 | Le système envoie un code OTP à 6 chiffres par SMS au numéro fourni.                                                          | M    | Fait (SMS réel à brancher) |
| FR-AUTH-03 | Le compte n'est créé qu'**après** la saisie d'un OTP valide. Aucune donnée de compte n'existe avant.                          | M    | Fait                       |
| FR-AUTH-04 | Un utilisateur existant se connecte avec son numéro et un OTP, sans mot de passe.                                             | M    | Fait                       |
| FR-AUTH-05 | Le numéro saisi est accepté sous plusieurs formes (`06 123 45 67`, `+242 06...`) et stocké au format E.164.                   | M    | Fait                       |
| FR-AUTH-06 | Après vérification, une session est ouverte pour 30 jours (cookie `HttpOnly`).                                                | M    | Fait                       |
| FR-AUTH-07 | L'utilisateur connecté peut consulter son profil (`GET /auth/me`).                                                            | M    | À tester                   |
| FR-AUTH-08 | L'utilisateur peut se déconnecter (`POST /auth/logout`) ; la session est supprimée.                                           | M    | À tester                   |
| FR-AUTH-09 | L'utilisateur peut modifier son nom et son opérateur Mobile Money.                                                            | S    | À faire                    |
| FR-AUTH-10 | Le changement de numéro de téléphone exige une nouvelle vérification OTP du nouveau numéro.                                   | C    | À faire                    |

**Critères d'acceptation**

- Un OTP expire après 5 minutes, n'est utilisable qu'une fois, et est bloqué après 5 essais.
- Une nouvelle demande d'OTP pour un même numéro n'est acceptée qu'après 60 secondes.
- Un numéro invalide ou hors indicatif +242 est refusé avec un message clair.
- Une requête protégée sans session valide reçoit une réponse 401.
- Les messages d'erreur d'OTP ne révèlent pas si un numéro est inscrit.

### 2.2 Groupes (GRP)

| ID        | Exigence                                                                                                                                                                                                         | Prio | Statut      |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------- |
| FR-GRP-01 | Un membre connecté peut créer un groupe : nom, description, montant par cycle (XAF, entier positif), fréquence (hebdomadaire, bimensuelle, mensuelle), date de démarrage, nombre maximum de membres (optionnel). | M    | À faire     |
| FR-GRP-02 | Le créateur devient administrateur du groupe.                                                                                                                                                                    | M    | À faire     |
| FR-GRP-03 | Un groupe a un statut : `draft`, `active`, `completed`, `cancelled`.                                                                                                                                             | M    | Schéma prêt |
| FR-GRP-04 | Un membre peut lister les groupes auxquels il appartient et consulter le détail de chacun.                                                                                                                       | M    | À faire     |
| FR-GRP-05 | L'administrateur peut modifier les paramètres du groupe tant qu'il est en `draft`.                                                                                                                               | M    | À faire     |
| FR-GRP-06 | L'administrateur peut annuler un groupe ; aucun groupe n'est supprimé physiquement.                                                                                                                              | S    | À faire     |

**Critères d'acceptation**

- Seuls les membres d'un groupe voient son détail.
- Seul l'administrateur peut modifier ou annuler le groupe.
- Le montant par cycle ne peut plus être modifié une fois le groupe `active`.

### 2.3 Invitations (INV)

| ID        | Exigence                                                                                                                                                                           | Prio | Statut      |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------- |
| FR-INV-01 | L'administrateur peut générer un lien d'invitation unique, partageable (WhatsApp, SMS, réseaux sociaux).                                                                           | M    | À faire     |
| FR-INV-02 | Le lien peut avoir une date d'expiration et un nombre maximum d'utilisations.                                                                                                      | S    | Schéma prêt |
| FR-INV-03 | L'administrateur peut révoquer un lien.                                                                                                                                            | M    | Schéma prêt |
| FR-INV-04 | Toute personne ouvrant un lien valide voit un aperçu du groupe (nom, montant, fréquence, date de démarrage, places restantes, nom de l'administrateur), sans numéros de téléphone. | M    | À faire     |
| FR-INV-05 | Un visiteur non inscrit qui ouvre un lien est conduit à l'inscription, puis ramené automatiquement à l'invitation.                                                                 | M    | À faire     |
| FR-INV-06 | Un utilisateur connecté doit confirmer explicitement pour rejoindre le groupe.                                                                                                     | M    | À faire     |
| FR-INV-07 | Un utilisateur déjà membre est redirigé vers le groupe, sans erreur.                                                                                                               | M    | À faire     |

**Critères d'acceptation**

- Un lien expiré, révoqué, épuisé, ou un groupe non `draft` ou complet est refusé avec un message explicite.
- L'ajout au groupe et l'incrément du compteur d'utilisation se font de manière atomique.
- Un même utilisateur ne peut pas être ajouté deux fois, même en cas de double clic.

### 2.4 Membres et ordre de passage (MEM)

| ID        | Exigence                                                                   | Prio | Statut  |
| --------- | -------------------------------------------------------------------------- | ---- | ------- |
| FR-MEM-01 | L'administrateur peut définir l'ordre de passage manuellement.             | M    | À faire |
| FR-MEM-02 | L'administrateur peut déclencher un tirage au sort de l'ordre.             | S    | À faire |
| FR-MEM-03 | L'administrateur peut retirer un membre tant que le groupe est en `draft`. | M    | À faire |
| FR-MEM-04 | Un membre peut quitter un groupe en `draft`.                               | M    | À faire |
| FR-MEM-05 | Tous les membres voient l'ordre de passage.                                | M    | À faire |

### 2.5 Activation et calendrier (CAL)

| ID        | Exigence                                                                                                                     | Prio | Statut      |
| --------- | ---------------------------------------------------------------------------------------------------------------------------- | ---- | ----------- |
| FR-CAL-01 | L'administrateur valide l'ordre et active le groupe : le statut passe à `active` et l'ordre est verrouillé.                  | M    | À faire     |
| FR-CAL-02 | À l'activation, le système génère un cycle par membre, avec date limite (date de démarrage + k × fréquence) et bénéficiaire. | M    | À faire     |
| FR-CAL-03 | À l'activation, le système génère une cotisation attendue par membre et par cycle.                                           | M    | À faire     |
| FR-CAL-04 | Tout membre peut consulter le calendrier : date de chaque cycle, bénéficiaire, avancement des paiements.                     | M    | À faire     |
| FR-CAL-05 | Un cycle passe par les statuts `upcoming`, `collecting`, `collected`, `paid_out`.                                            | M    | Schéma prêt |

**Critères d'acceptation**

- L'activation est refusée si un membre actif n'a pas de position, ou s'il y a moins de 2 membres.
- La génération du calendrier est atomique : tout est créé, ou rien.

### 2.6 Paiements Mobile Money (PAY)

| ID        | Exigence                                                                                                                                  | Prio | Statut  |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------- |
| FR-PAY-01 | Un membre peut payer sa cotisation : le système déclenche une demande de confirmation USSD sur son téléphone (MTN ou Airtel) via Pawapay. | M    | À faire |
| FR-PAY-02 | Le système reçoit les webhooks Pawapay, vérifie leur signature, et met à jour la transaction et la cotisation.                            | M    | À faire |
| FR-PAY-03 | Un job de réconciliation interroge Pawapay pour les transactions restées en attente trop longtemps.                                       | M    | À faire |
| FR-PAY-04 | Lorsque toutes les cotisations d'un cycle sont payées, le cycle passe en `collected`.                                                     | M    | À faire |
| FR-PAY-05 | Le système envoie automatiquement la cagnotte au compte Mobile Money du bénéficiaire.                                                     | M    | À faire |
| FR-PAY-06 | Un paiement échoué peut être relancé ; le motif d'échec est visible.                                                                      | M    | À faire |
| FR-PAY-07 | Le dernier cycle distribué fait passer le groupe en `completed`.                                                                          | M    | À faire |
| FR-PAY-08 | L'administrateur est alerté d'un payout échoué.                                                                                           | M    | À faire |

**Critères d'acceptation**

- Une cotisation ne peut jamais être prélevée deux fois, et un cycle ne peut jamais être payé deux fois au bénéficiaire (contraintes en base et identifiant de transaction envoyé à Pawapay).
- Un même webhook reçu plusieurs fois produit le même résultat qu'un seul.
- Un membre ne peut payer que sa propre cotisation.

### 2.7 Suivi (SUI)

| ID        | Exigence                                                                                                                        | Prio | Statut  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------- | ---- | ------- |
| FR-SUI-01 | Chaque cotisation affiche un statut : `Payé`, `En attente`, `En retard` (en attente après la date limite, calculé, non stocké). | M    | À faire |
| FR-SUI-02 | Le statut se met à jour sans rechargement manuel (rafraîchissement automatique).                                                | S    | À faire |
| FR-SUI-03 | Un membre peut consulter l'historique de ses transactions (dépôts et payouts) avec leur statut.                                 | S    | À faire |
| FR-SUI-04 | L'administrateur voit d'un coup d'œil qui est en retard dans le cycle en cours.                                                 | M    | À faire |

### 2.8 Notifications (NOT)

| ID        | Exigence                                                                   | Prio | Statut  |
| --------- | -------------------------------------------------------------------------- | ---- | ------- |
| FR-NOT-01 | Un rappel est envoyé aux membres n'ayant pas payé à J-7 de la date limite. | M    | À faire |
| FR-NOT-02 | Un rappel est envoyé à J-1.                                                | S    | À faire |
| FR-NOT-03 | Un rappel de retard est envoyé après la date limite.                       | S    | À faire |
| FR-NOT-04 | Le bénéficiaire est notifié de la réception de la cagnotte.                | M    | À faire |
| FR-NOT-05 | Le membre est notifié de la confirmation ou de l'échec de son paiement.    | S    | À faire |
| FR-NOT-06 | Les rappels passent par SMS en priorité, avec WhatsApp ou push en option.  | M    | À faire |

**Critères d'acceptation**

- Un même rappel n'est jamais envoyé deux fois, même si la tâche s'exécute deux fois.
- Un membre qui a déjà payé ne reçoit aucun rappel.
- Les rappels sont calculés selon le fuseau Africa/Brazzaville.

## 3. Règles métier

| ID    | Règle                                                                                                                                   | Statut    |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| RM-01 | Tous les membres cotisent à chaque cycle, y compris le bénéficiaire ; cagnotte = nombre de membres × montant.                           | À valider |
| RM-02 | Le bénéficiaire est payé seulement quand la cagnotte du cycle est complète.                                                             | À valider |
| RM-03 | Aucun nouveau membre ne peut rejoindre un groupe `active`.                                                                              | À valider |
| RM-04 | Un membre ne peut pas quitter un groupe actif s'il a reçu la cagnotte ou doit encore cotiser ; l'administrateur tranche les exceptions. | À valider |
| RM-05 | Les frais Pawapay sont à la charge de : le payeur en plus de sa cotisation, ou prélevés sur la cagnotte.                                | À valider |
| RM-06 | L'annulation d'un groupe rembourse les cotisations d'un cycle non distribué.                                                            | À valider |
| RM-07 | Un seul numéro de téléphone par compte, et un seul compte par numéro.                                                                   | Défini    |
| RM-08 | Les montants sont en XAF, en nombres entiers.                                                                                           | Défini    |

## 4. Exigences non fonctionnelles

### 4.1 Performance

| ID          | Exigence                                                                         | Cible proposée                                                  |
| ----------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| NFR-PERF-01 | Temps de réponse des routes API (hors appels Pawapay et SMS)                     | p95 inférieur à 500 ms avec backend et base dans la même région |
| NFR-PERF-02 | Chargement initial d'une page sur connexion 3G                                   | Moins de 3 secondes pour le contenu utile                       |
| NFR-PERF-03 | Taille du JavaScript de la première page                                         | Moins de 200 Ko compressés                                      |
| NFR-PERF-04 | Délai entre la confirmation USSD d'un membre et l'affichage de son statut `Payé` | Moins de 10 secondes                                            |

### 4.2 Disponibilité et fiabilité

| ID          | Exigence                                                                                            | Cible proposée                               |
| ----------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| NFR-FIAB-01 | Disponibilité mensuelle de l'API                                                                    | 99,5 %                                       |
| NFR-FIAB-02 | Aucune perte de transaction : toute opération financière est enregistrée avant l'appel à Pawapay    | 100 %                                        |
| NFR-FIAB-03 | Les webhooks Pawapay sont traités de façon idempotente, et un job rattrape ceux qui sont perdus     | Réconciliation toutes les 5 à 10 minutes     |
| NFR-FIAB-04 | Les rappels sont exécutés même après un redémarrage du serveur                                      | Planificateur externe (QStash) ou persistant |
| NFR-FIAB-05 | Arrêt propre du serveur : les requêtes en cours se terminent et les connexions à la base se ferment | Fait                                         |

### 4.3 Sécurité

| ID         | Exigence                                                                                                                                           |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-SEC-01 | Toutes les données entrantes sont validées avec Zod avant traitement. **(Fait)**                                                                   |
| NFR-SEC-02 | Les codes OTP sont stockés hachés (HMAC avec secret), comparés à temps constant, avec 5 essais maximum. **(Fait)**                                 |
| NFR-SEC-03 | Limitation de débit par adresse IP sur les routes d'authentification (10 requêtes par 15 minutes) et par numéro (1 demande par minute). **(Fait)** |
| NFR-SEC-04 | La session est un JWT dans un cookie `HttpOnly`, `Secure` en production, `SameSite=Lax`. **(Fait)**                                                |
| NFR-SEC-05 | CORS limité à l'origine du frontend ; en-têtes de sécurité HTTP (helmet) ; taille des corps JSON limitée. **(Fait)**                               |
| NFR-SEC-06 | Les secrets (clés Pawapay, base de données, JWT, OTP, fournisseur SMS) vivent dans des variables d'environnement, jamais dans le dépôt.            |
| NFR-SEC-07 | Les webhooks Pawapay sont authentifiés par vérification de signature sur le corps brut.                                                            |
| NFR-SEC-08 | Autorisation par rôle : seul l'administrateur modifie, active ou annule un groupe ; un membre ne paie que ses propres cotisations.                 |
| NFR-SEC-09 | Aucun secret, code OTP ou token dans les journaux en production ; les messages d'erreur techniques ne sont pas renvoyés au client. **(Fait)**      |
| NFR-SEC-10 | Le code OTP fixe de test n'est actif que si `NODE_ENV` vaut explicitement `development`. **(Fait)**                                                |

### 4.4 Intégrité des données

| ID          | Exigence                                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| NFR-DATA-01 | Les contraintes d'unicité et les index partiels empêchent en base les doubles paiements, doublons de membres et d'ordre. **(Schéma prêt)** |
| NFR-DATA-02 | Les opérations multi-tables (activation, paiement validé, rejoindre un groupe) sont exécutées en une seule transaction SQL.                |
| NFR-DATA-03 | Aucune suppression physique de données financières : on change le statut.                                                                  |
| NFR-DATA-04 | Chaque transaction conserve le dernier callback Pawapay brut pour l'audit.                                                                 |

### 4.5 Utilisabilité, accessibilité et langues

| ID        | Exigence                                                                                          | Cible proposée                    |
| --------- | ------------------------------------------------------------------------------------------------- | --------------------------------- |
| NFR-UX-01 | Interface mobile-first, utilisable à une main sur écran de 360 px de large                        | Obligatoire                       |
| NFR-UX-02 | Application installable (PWA)                                                                     | Obligatoire                       |
| NFR-UX-03 | Inscription ou connexion complétée en moins de 2 minutes, incluant la saisie de l'OTP             | Mesuré en test utilisateur        |
| NFR-UX-04 | Interface en français, avec prise en charge de l'internationalisation (lingala, kituba plus tard) | Obligatoire pour la v1 : français |
| NFR-UX-05 | Contraste et tailles de texte conformes WCAG 2.1 niveau AA                                        | Cible                             |
| NFR-UX-06 | Messages d'erreur compréhensibles et orientés action                                              | Obligatoire                       |

### 4.6 Compatibilité

| ID          | Exigence                                                                                                          |
| ----------- | ----------------------------------------------------------------------------------------------------------------- |
| NFR-COMP-01 | Navigateurs mobiles : Chrome et Safari des deux dernières années, navigateurs Android d'entrée de gamme courants. |
| NFR-COMP-02 | Fonctionne en connexion lente ou instable : indicateurs de chargement, reprise après échec réseau.                |

### 4.7 Exploitation et observabilité

| ID         | Exigence                                                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| NFR-EXP-01 | Journaux structurés avec identifiant de transaction ; alertes sur les paiements bloqués en `processing` et sur le taux d'échec Pawapay.                            |
| NFR-EXP-02 | Trois environnements : développement, staging (Pawapay sandbox, branche Neon dédiée), production.                                                                  |
| NFR-EXP-03 | Migrations de base appliquées par `drizzle-kit migrate` en intégration continue, jamais `push` en production.                                                      |
| NFR-EXP-04 | Sauvegardes : restauration à un instant donné via Neon, procédure testée. Cible : perte de données maximale de 15 minutes, remise en service en moins de 4 heures. |
| NFR-EXP-05 | Nettoyage régulier des données temporaires (codes OTP expirés).                                                                                                    |

### 4.8 Maintenabilité

| ID           | Exigence                                                                                                                                |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-MAINT-01 | Architecture en couches : routes, middlewares, contrôleurs, services (logique métier sans dépendance à HTTP). **(Fait pour auth)**      |
| NFR-MAINT-02 | TypeScript strict (`noUncheckedIndexedAccess` activé). **(Fait)**                                                                       |
| NFR-MAINT-03 | Tests automatisés : règles métier (calendrier, retard), idempotence des paiements, flux OTP. Couverture cible de 80 % sur les services. |
| NFR-MAINT-04 | Le fournisseur SMS est interchangeable derrière une interface unique (`sendSms`).                                                       |

### 4.9 Conformité et données personnelles

| ID          | Exigence                                                                                                                                                              |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-CONF-01 | Données personnelles limitées au strict nécessaire : nom, numéro, opérateur.                                                                                          |
| NFR-CONF-02 | Les conditions pour collecter et redistribuer des fonds de tiers (statut juridique, KYC, plafonds) sont validées avec Pawapay et un conseil local avant le lancement. |
| NFR-CONF-03 | L'identifiant d'expéditeur SMS est déclaré selon les exigences de l'ARPCE si le fournisseur le demande.                                                               |
| NFR-CONF-04 | Un utilisateur peut demander la suppression de son compte, sous réserve de conserver les données financières obligatoires (anonymisées).                              |

### 4.10 Coûts

| ID          | Exigence                                                                                                              |
| ----------- | --------------------------------------------------------------------------------------------------------------------- |
| NFR-COUT-01 | Le coût SMS est maîtrisé : session de 30 jours (OTP une fois par appareil), limites d'envoi, WhatsApp en alternative. |
| NFR-COUT-02 | Backend et base hébergés dans la même région pour limiter la latence, et choix d'une région proche de l'utilisateur.  |

## 5. Contraintes et hypothèses

- Les utilisateurs ont un téléphone mobile avec MTN MoMo ou Airtel Money actif.
- La connexion est souvent lente ou instable ; la latence vers une base hébergée aux États-Unis est mesurable depuis le Congo en développement.
- Pawapay couvre l'entrée et la sortie d'argent pour MTN et Airtel au Congo-Brazzaville, avec des plafonds à confirmer.
- Le coût d'un SMS vers le Congo est significatif : il influence la conception de l'authentification.
- Une seule devise (XAF) en v1.

## 6. Traçabilité (exigences → implémentation)

| Module | Tables                                    | Routes principales                                                                     |
| ------ | ----------------------------------------- | -------------------------------------------------------------------------------------- |
| AUTH   | `users`, `otp_codes`                      | `POST /auth/otp/request`, `POST /auth/otp/verify`, `GET /auth/me`, `POST /auth/logout` |
| GRP    | `groups`                                  | `POST /groups`, `GET /groups`, `GET /groups/:id`, `PATCH /groups/:id`                  |
| INV    | `group_invites`, `group_members`          | `POST /groups/:id/invites`, `GET /invites/:code`, `POST /invites/:code/join`           |
| MEM    | `group_members`                           | `PUT /groups/:id/order`, `DELETE /groups/:id/members/:memberId`                        |
| CAL    | `cycles`, `contributions`                 | `POST /groups/:id/activate`, `GET /groups/:id/cycles`                                  |
| PAY    | `transactions`, `contributions`, `cycles` | `POST /contributions/:id/pay`, `POST /webhooks/pawapay`                                |
| NOT    | `reminders`                               | `POST /internal/jobs/reminders`                                                        |

## 7. Hors périmètre v1

Prêts et intérêts, paiements par carte ou en espèces, plusieurs devises, application mobile native, messagerie interne au groupe, ajout de membres en cours de tontine, marchés hors Congo-Brazzaville.

## 8. Questions ouvertes

1. Qui supporte les frais Pawapay (RM-05) ?
2. Le bénéficiaire cotise-t-il dans son propre cycle (RM-01) ?
3. Que faire d'un cycle dont la cagnotte reste incomplète au-delà d'un délai (avance par l'administrateur, pénalités, report) ?
4. L'application prélèvera-t-elle une commission, et laquelle ?
5. Faut-il un KYC allégé selon les montants (pièce d'identité) ?
6. Quel est le plafond de montant par cycle accepté par Pawapay et les opérateurs ?
