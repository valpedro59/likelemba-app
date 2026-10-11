import { db, pool } from "./index.js";
import {
  users,
  groups,
  groupMembers,
  cycles,
  contributions,
  transactions,
  reminders,
  groupInvites,
} from "./schema.js";

const AMOUNT = 10_000; // XAF par cycle

// Satisfait noUncheckedIndexedAccess : échoue clairement si la valeur manque
function must<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`Seed : ${label} introuvable`);
  return value;
}

function addMonths(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

async function seed() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Seed interdit en production");
  }

  console.log("Seed en cours...");

  await db.transaction(async (trx) => {
    // 0. Reset (ordre inverse des clés étrangères)
    await trx.delete(reminders);
    await trx.delete(transactions);
    await trx.delete(contributions);
    await trx.delete(cycles);
    await trx.delete(groupInvites);
    await trx.delete(groupMembers);
    await trx.delete(groups);
    await trx.delete(users);

    // 1. Utilisateurs (numéros fictifs)
    const insertedUsers = await trx
      .insert(users)
      .values([
        { fullName: "Val Pedro", phone: "+242060000001", momoProvider: "MTN" },
        {
          fullName: "Grace Mavoungou",
          phone: "+242050000002",
          momoProvider: "AIRTEL",
        },
        {
          fullName: "Junior Ngoma",
          phone: "+242060000003",
          momoProvider: "MTN",
        },
        {
          fullName: "Sandra Itoua",
          phone: "+242050000004",
          momoProvider: "AIRTEL",
        },
        {
          fullName: "Prince Moukala",
          phone: "+242060000005",
          momoProvider: "MTN",
        },
      ])
      .returning();
    const userById = new Map(insertedUsers.map((u) => [u.id, u]));
    const admin = must(insertedUsers[0], "admin");

    // 2. Groupe (démarré le mois dernier)
    const startDate = addMonths(new Date().toISOString().slice(0, 10), -1);
    const [groupRow] = await trx
      .insert(groups)
      .values({
        name: "Likelemba des collègues",
        description: "Cotisation mensuelle entre amis",
        creatorId: admin.id,
        amountPerCycle: AMOUNT,
        frequency: "monthly",
        startDate,
        status: "active",
      })
      .returning();
    const group = must(groupRow, "groupe");

    // 3. Lien d'invitation
    await trx.insert(groupInvites).values({
      groupId: group.id,
      code: "demo-invite-code",
      createdBy: admin.id,
    });

    // 4. Membres avec ordre de passage
    const members = await trx
      .insert(groupMembers)
      .values(
        insertedUsers.map((u, i) => ({
          groupId: group.id,
          userId: u.id,
          role: i === 0 ? ("admin" as const) : ("member" as const),
          payoutOrder: i + 1,
        })),
      )
      .returning();
    members.sort((a, b) => (a.payoutOrder ?? 0) - (b.payoutOrder ?? 0));

    // 5. Cycles : 1 payé, 1 en collecte, les autres à venir
    const insertedCycles = await trx
      .insert(cycles)
      .values(
        members.map((m, i) => ({
          groupId: group.id,
          cycleNumber: i + 1,
          beneficiaryMemberId: m.id,
          dueDate: addMonths(startDate, i),
          status:
            i === 0
              ? ("paid_out" as const)
              : i === 1
                ? ("collecting" as const)
                : ("upcoming" as const),
          payoutCompletedAt: i === 0 ? new Date() : null,
        })),
      )
      .returning();
    insertedCycles.sort((a, b) => a.cycleNumber - b.cycleNumber);
    const firstCycle = must(insertedCycles[0], "premier cycle");
    const firstMember = must(members[0], "premier membre");

    // 6. Cotisations attendues (membre x cycle)
    const contributionRows = insertedCycles.flatMap((c) =>
      members.map((m) => {
        const paid =
          c.cycleNumber === 1 ||
          (c.cycleNumber === 2 && (m.payoutOrder ?? 0) <= 2);
        return {
          cycleId: c.id,
          memberId: m.id,
          amount: AMOUNT,
          status: paid ? ("paid" as const) : ("pending" as const),
          paidAt: paid ? new Date() : null,
        };
      }),
    );
    const insertedContributions = await trx
      .insert(contributions)
      .values(contributionRows)
      .returning();

    // 7. Transactions : un dépôt réussi par cotisation payée
    const memberById = new Map(members.map((m) => [m.id, m]));
    const depositRows = insertedContributions
      .filter((c) => c.status === "paid")
      .map((c) => {
        const user = userById.get(memberById.get(c.memberId)!.userId)!;
        return {
          type: "contribution" as const,
          cycleId: c.cycleId,
          contributionId: c.id,
          userId: user.id,
          amount: c.amount,
          provider: user.momoProvider,
          phone: user.phone,
          status: "successful" as const,
        };
      });
    await trx.insert(transactions).values(depositRows);

    // 8. Payout du cycle 1 vers son bénéficiaire
    const beneficiary = must(userById.get(firstMember.userId), "bénéficiaire");
    await trx.insert(transactions).values({
      type: "payout",
      cycleId: firstCycle.id,
      userId: beneficiary.id,
      amount: AMOUNT * members.length,
      provider: beneficiary.momoProvider,
      phone: beneficiary.phone,
      status: "successful",
    });
  });

  console.log("Seed terminé.");
}

seed()
  .catch((err) => {
    console.error("Seed échoué :", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
