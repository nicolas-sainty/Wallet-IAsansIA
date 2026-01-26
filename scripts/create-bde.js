const db = require('../src/config/database');
const groupService = require('../src/services/group.service');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function createBDE() {
    try {
        console.log("=== Création d'un BDE ===");

        // 1. Get Admin User
        const email = await question("Email de l'administrateur BDE : ");
        const userRes = await db.query("SELECT * FROM users WHERE email = $1", [email]);

        if (userRes.rows.length === 0) {
            console.error("❌ Utilisateur non trouvé.");
            process.exit(1);
        }
        const user = userRes.rows[0];
        console.log(`✅ Utilisateur trouvé: ${user.full_name || user.email}`);

        // 2. Get BDE Name
        const name = await question("Nom du BDE : ");
        if (!name) {
            console.error("❌ Nom invalide.");
            process.exit(1);
        }

        // 3. Create Group
        console.log("⏳ Création du groupe...");
        const group = await groupService.createGroup(name, user.user_id, { type: 'BDE' });
        console.log(`✅ Groupe créé: ${group.group_id}`);

        // 4. Update User Role & Link
        console.log("⏳ Mise à jour des permissions administrateur...");
        await db.query(
            "UPDATE users SET role = 'bde_admin', bde_id = $1 WHERE user_id = $2",
            [group.group_id, user.user_id]
        );
        console.log("✅ Rôle mis à jour.");

        console.log("\n🎉 BDE créé avec succès !");
        console.log(`Nom : ${name}`);
        console.log(`Admin : ${email}`);

    } catch (error) {
        console.error("❌ Erreur:", error);
    } finally {
        rl.close();
        process.exit();
    }
}

createBDE();
