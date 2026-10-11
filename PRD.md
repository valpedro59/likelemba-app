# Product Requirement Document (PRD) : Likelemba-app

## 1. Vue d'ensemble

- **Nom du produit** : Likelemba-app
- **Objectif** : digitaliser, automatiser et sécuriser la gestion des tontines traditionnelles africaines (Likelemba / Likilimba) via une plateforme web collaborative, mobile-first (PWA).
- **Proposition de valeur** : fini les carnets, les relances manuelles et les disputes sur « qui a payé ». Chaque membre voit l'ordre de passage, le calendrier, l'état des cotisations de tous, et paie par Mobile Money en quelques secondes.
- **Cible** : cercles d'amis, familles, collègues, communautés. Marché initial : Congo-Brazzaville (+242), opérateurs MTN et Airtel.

## 2. Périmètre

### Inclus dans la v1

- Inscription par numéro de téléphone avec vérification OTP
- Création de groupes, invitation par lien, constitution de l'ordre de passage
- Génération automatique du calendrier des cycles
- Collecte des cotisations par Mobile Money (Pawapay)
- Distribution automatique de la cagnotte au bénéficiaire
- Suivi en temps réel des paiements
- Rappels automatiques (J-7, J-1, retard)

### Hors périmètre v1

- Prêts, intérêts, épargne rémunérée
- Paiements par carte bancaire ou en espèces
- Plusieurs devises dans un même groupe
- Application mobile native (la PWA suffit)
- Messagerie interne au groupe
- Marché hors Congo-Brazzaville

## 3. Personas

1. **Administrateur / créateur du groupe** : crée le Likelemba, fixe montant et fréquence, invite les membres, valide l'ordre de passage, suit les retards.
2. **Participant / membre** : rejoint via un lien, consulte le calendrier, paie sa cotisation, reçoit la cagnotte à son tour.

## 4. Fonctionnalités et critères d'acceptation

### 4.1 Comptes et authentification

- Inscription avec nom complet, numéro de téléphone (+242) et opérateur MoMo (MTN ou Airtel).
- Vérification du numéro par code OTP envoyé par SMS.
- Connexion par numéro + OTP, sans mot de passe.

**Critères d'acceptation**

- Un numéro ne peut créer qu'un seul compte.
- Le code OTP expire au bout de 5 minutes et est limité en nombre de tentatives.
- Un utilisateur ne peut pas rejoindre un groupe ni payer tant que son numéro n'est pas vérifié.

### 4.2 Groupes et invitations

- Création : nom, description, montant par cycle, fréquence (hebdomadaire, bimensuelle, mensuelle), date de démarrage, nombre maximum de membres (optionnel).
- Statuts d'un groupe : `brouillon` → `actif` → `terminé` ou `annulé`.
- Lien d'invitation unique, partageable par WhatsApp, SMS ou réseaux sociaux. L'admin peut fixer une expiration et un nombre d'utilisations maximum, ou révoquer le lien.

**Critères d'acceptation**

- Le montant par cycle est un entier strictement positif en XAF.
- Un lien expiré, révoqué ou épuisé affiche un message clair et ne permet pas de rejoindre.
- On ne peut plus rejoindre un groupe une fois qu'il est `actif` **[À valider]**.

### 4.3 Ordre de passage (« Qui reçoit quand »)

- L'admin attribue l'ordre manuellement ou par tirage au sort.
- L'ordre est modifiable tant que le groupe est en `brouillon`. La validation de l'ordre fait passer le groupe en `actif` et verrouille l'ordre.
- Génération automatique du calendrier : un cycle par membre, avec date limite, bénéficiaire et montant attendu de chaque membre.

**Critères d'acceptation**

- Aucun doublon dans l'ordre ; tous les membres actifs ont une position.
- Le calendrier montre à chaque membre la date exacte à laquelle il reçoit la cagnotte.

### 4.4 Paiements Mobile Money (Pawapay)

- **Cotisation (entrant)** : bouton « Payer » qui déclenche une demande de confirmation USSD sur le téléphone du membre (MTN ou Airtel).
- **Distribution (sortant)** : une fois toutes les cotisations du cycle reçues, la cagnotte est envoyée au compte MoMo du bénéficiaire.
- **Suivi** : statut par membre et par cycle : `Payé`, `En attente`, `En retard` (en attente après la date limite).

**Critères d'acceptation**

- Un membre ne peut pas être prélevé deux fois pour la même cotisation.
- Le bénéficiaire ne peut pas être payé deux fois pour le même cycle.
- Un paiement échoué peut être relancé ; le motif d'échec est visible.
- Le statut se met à jour sans rechargement manuel de la page (rafraîchissement automatique).

### 4.5 Notifications et rappels

- Rappel à J-7, J-1 et en cas de retard, pour les membres n'ayant pas payé.
- Canaux : SMS en priorité, WhatsApp et notifications push ensuite.
- Notification au bénéficiaire quand la cagnotte lui est envoyée, et à l'admin en cas de paiement échoué ou de retard.

**Critères d'acceptation**

- Un même rappel n'est jamais envoyé deux fois à la même personne.
- Un membre qui a déjà payé ne reçoit aucun rappel.

## 5. Règles métier

| Sujet                            | Règle par défaut proposée                                                                                                            | Statut    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| Qui cotise dans un cycle         | Tous les membres, y compris le bénéficiaire ; cagnotte = nombre de membres × montant                                                 | À valider |
| Membre en retard                 | Le bénéficiaire n'est payé qu'une fois la cagnotte complète ; l'admin est alerté dès le jour de retard                               | À valider |
| Frais Pawapay                    | À définir : à la charge du payeur en plus de la cotisation, ou prélevés sur la cagnotte                                              | À valider |
| Départ d'un membre               | Impossible une fois le groupe actif s'il a déjà reçu la cagnotte ou s'il doit encore cotiser ; l'admin tranche les cas exceptionnels | À valider |
| Nouveau membre en cours de route | Non autorisé en v1                                                                                                                   | À valider |
| Annulation du groupe             | Possible par l'admin ; remboursement des cotisations d'un cycle non distribué                                                        | À valider |
| Fin du groupe                    | Quand tous les cycles sont distribués, le groupe passe en `terminé`                                                                  | Défini    |

## 6. Exigences non fonctionnelles

- **Mobile-first et PWA** : utilisable sur smartphone d'entrée de gamme et connexion lente (3G).
- **Langues** : français en v1 ; prévoir l'internationalisation (lingala, kituba plus tard).
- **Fiabilité** : aucune perte de transaction ; toute opération financière est traçable et auditable.
- **Sécurité** : données personnelles minimales, chiffrement en transit, secrets hors du code.
- **Disponibilité** : cible de 99,5 % ; les rappels et le suivi des paiements ne doivent pas dépendre d'un seul processus.
- **Conformité** : vérifier avec Pawapay et la réglementation locale les conditions pour collecter et redistribuer des fonds de tiers (KYC, plafonds).

## 7. Indicateurs de succès

- Taux de cotisations payées avant la date limite (cible : 85 % ou plus)
- Nombre de groupes actifs et nombre moyen de membres par groupe
- Taux de réussite des paiements Mobile Money
- Délai moyen entre la fin de collecte d'un cycle et la distribution
- Taux de conversion des liens d'invitation (clics → membres inscrits)
- Part des rappels suivis d'un paiement dans les 24 h

## 8. Risques

| Risque                                                              | Impact              | Mitigation                                                                               |
| ------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------- |
| Couverture Pawapay ou plafonds des opérateurs insuffisants au Congo | Bloquant            | Valider tôt la couverture MTN et Airtel Congo, en entrant et en sortant, et les plafonds |
| Membres qui ne paient pas                                           | Perte de confiance  | Rappels, visibilité publique du statut, règles claires dans le groupe                    |
| Échec ou doublon de paiement                                        | Perte financière    | Idempotence, contraintes en base, réconciliation automatique                             |
| Obligations réglementaires                                          | Blocage juridique   | Cadrage avec Pawapay ou un conseil local avant le lancement                              |
| Faible connectivité                                                 | Mauvaise expérience | PWA légère, pages rapides, SMS comme canal principal                                     |

## 9. Questions ouvertes

1. Les frais Pawapay sont-ils à la charge des membres ou de la cagnotte ?
2. Le bénéficiaire cotise-t-il dans son propre cycle ?
3. Que faire d'un cycle où la cagnotte reste incomplète trop longtemps (délai maximum, avance par l'admin) ?
4. L'application prélèvera-t-elle une commission, et laquelle ?
5. Faut-il une pièce d'identité ou un KYC allégé selon les montants ?
