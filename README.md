# Kingdom Reforged Card Editor

Editeur statique pour prototyper, equilibrer et imprimer les cartes de **Kingdom Reforged**.

## Utiliser l'editeur

Ouvre `index.html` dans un navigateur, ou utilise la version publiee avec GitHub Pages.

Les donnees sont sauvegardees dans le navigateur avec `localStorage` et IndexedDB. Le mode **Cloud** permet aussi de synchroniser les cartes, decks, images, ressources et bonus avec Supabase.

## Fonctions principales

- Creation de cartes par types: batiment, exploration, tresor et action.
- Edition des etapes, couts, bonus, boucliers et illustrations.
- Vue grille avec panneau lateral de navigation.
- Bibliotheques d'images, de ressources et de bonus.
- Import/export JSON et impression print-and-play.
- Undo/redo local pendant l'edition.
- Cadenas d'edition: les menus Decks, Images, Ressources et Bonus demandent un mot de passe avant modification.

## Supabase

Le site reste statique sur GitHub Pages. Supabase sert seulement de sauvegarde partagee.

1. Cree un projet Supabase.
2. Colle `supabase/schema.sql` dans le SQL Editor Supabase et execute-le.
3. Deploie l'Edge Function `supabase/functions/kingdom-sync` avec `supabase functions deploy kingdom-sync`.
4. Ajoute le secret avec `supabase secrets set KINGDOM_EDIT_PASSWORD=ton-mot-de-passe`.
5. Dans l'editeur, clique sur **Cloud** et renseigne:
   - Project URL: `https://xxxx.supabase.co`
   - Anon public key
   - Projet: `main` par defaut
   - Mot de passe d'edition

Ne mets jamais la cle `service_role` dans l'editeur ou dans GitHub Pages.

## Publication

Ce projet est un site statique. La partie cloud est optionnelle et passe par Supabase.
