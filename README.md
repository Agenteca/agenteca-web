# Agenteca Web

Site du catalogue Agenteca : recherche, filtre par outil compatible, contenu de chaque paquet lisible avant installation, bouton « copier la commande d'installation ».

> État : 0.1.0 ; l'image Docker n'est pas encore publiée. Catalogues publics seulement : pas de connexion ni de page d'administration dans cette version (la publication passe par l'API ou `curl`).

Chaque page est rendue côté serveur (Astro) : le site fonctionne sans JavaScript, qui n'ajoute que le bouton de copie.

## Démarrer

Le site lit l'API d'`agenteca-server`, dont l'adresse est donnée par `AGENTECA_API_URL` (défaut : `http://localhost:8080`).

```bash
npm install
```

```bash
npm run build
```

```bash
AGENTECA_API_URL=http://localhost:8080 npm start
```

Avec Docker, voir `compose.yaml` dans `agenteca-server`.

## Accessibilité (WCAG 2.1 AA)

- Vérifié par les tests : règles axe-core sur chaque page servie (`test/pages.test.ts`) et contrastes des deux thèmes, clair et sombre (`test/contrast.test.ts`).
- Vérifié à la main : rendu visuel des pages catalogue et paquet dans un navigateur (thème sombre).
- Non vérifié : lecteur d'écran réel, navigation au clavier de bout en bout, zoom à 400 %, thème clair à l'œil.

## Tests

```bash
npm test
```

Les tests lancent le site construit face à une fausse API.

## Licence

AGPL-3.0. Contributions sous accord de contribution (CLA), voir le dépôt `.github` de l'organisation.
