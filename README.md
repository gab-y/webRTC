webRTC
======

Projet PAPPL ECN KOSMOPOLEAD

Le projet est actuellement au stade de prototype texte. Pour faire fonctionner le code veuillez suivre les instructions suivantes :
- le projet utilise un serveur node.js dont le code est disponible dans le fichier server.js. Des détails sur le fonctionnement de node sont disponibles plus bas.
- le serveur requiert les modules node-static et socket.io
- l'application est fonctionnelle sur Chrome, sur Firefox, et entre Chrome et Firefox
- il est possible de la tester en utilisant deux onglets connectés sur l'adresse localhost:2013
- une connexion internet est nécessaire pour utiliser les serveurs de communication Google/Mozilla du protocole ice
- le serveur est pour le moment très limité. Pour relancer une nouvelle connexion arrêter et relancer le serveur en ayant pris soin de nettoyer le cache navigateur
- le serveur ne supporte que deux utilisateurs et l'applcation n'est plus fonctionnelle au-delà

Fonctionnement node.js
- Installer node.js
- Dans l'invite de commandes se placer dans le dossier du projet
- Exécuter les installations : npm node-static ET npm socket.io
- Lancer le serveur : node server.js
- Arrêter le serveur : ctrl+C
