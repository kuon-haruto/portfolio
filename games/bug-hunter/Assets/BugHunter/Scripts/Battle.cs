using System;

namespace BugHunter
{
    // A seeded simulation, independent of frame rate and 3D transforms.
    public sealed class Battle
    {
        public sealed class Fighter
        {
            public Individual bug;
            public Species species;
            public float hp, energy = 100, balance = 100, down, immunity, clock;
            public Order order = Order.Attack;
            public int hits, falls;
            public float flash;
            public bool IsDown => down > 0;
            public int MaxHp => bug.Stat(species, 0);
            public Fighter(Individual bug, Species species) { this.bug = bug; this.species = species; hp = MaxHp; }
        }
        public readonly Fighter player, enemy;
        readonly Random random;
        float accumulator, elapsed;
        public bool ended;
        public bool Victory => ended && player.hp > 0;
        public string message = "試合開始";
        public int eventId;
        public Action<int, bool> impact;
        public Battle(Individual a, Species sa, Individual b, Species sb, int seed)
        {
            player = new Fighter(a, sa); enemy = new Fighter(b, sb); random = new Random(seed);
            player.clock = .4f; enemy.clock = .9f;
        }
        public static float Advantage(BugType a, BugType b) => a == b ? 1 : ((int)a + 1) % 3 == (int)b ? 1.16f : .9f;
        public static float FallChance(float balance, float energy, bool heavy, bool guarding)
        {
            float chance = .025f + (100 - balance) * .0022f + (100 - energy) * .0012f + (heavy ? .07f : 0);
            return Math.Max(.015f, Math.Min(.34f, chance * (guarding ? .28f : 1)));
        }
        public bool Command(Order order)
        {
            if (ended || player.IsDown) return false;
            player.order = order;
            return true;
        }
        public void Tick(float dt)
        {
            if (ended) return;
            accumulator += Math.Max(0, Math.Min(.25f, dt));
            while (accumulator >= .025f && !ended) { Step(.025f); accumulator -= .025f; }
        }
        void Step(float dt)
        {
            elapsed += dt;
            Recover(player, dt); Recover(enemy, dt);
            Act(player, enemy, dt, 0);
            if (!ended) Act(enemy, player, dt, 1);
            if (elapsed > 150 && !ended)
            {
                if (player.hp / player.MaxHp > enemy.hp / enemy.MaxHp) enemy.hp = 0; else player.hp = 0;
                ended = true; Say("時間切れ・残り体力で判定");
            }
        }
        void Recover(Fighter f, float dt)
        {
            f.immunity = Math.Max(0, f.immunity - dt); f.flash = Math.Max(0, f.flash - dt);
            if (f.IsDown)
            {
                f.down = Math.Max(0, f.down - dt);
                if (!f.IsDown) { f.immunity = 3; f.balance = 70; f.energy = Math.Max(35, f.energy); Say(f.bug.Name(f.species) + "が起き上がった"); }
            }
            else
            {
                f.energy = Math.Min(100, f.energy + dt * (f.order == Order.Guard ? 19 : 7));
                f.balance = Math.Min(100, f.balance + dt * (f.order == Order.Guard ? 24 : 7));
            }
        }
        void Act(Fighter a, Fighter b, float dt, int side)
        {
            if (a.IsDown) return;
            a.clock -= dt;
            if (a.clock > 0) return;
            if (side == 1)
            {
                double decision = random.NextDouble();
                a.order = a.energy < 27 || a.balance < 27 ? Order.Guard : decision < .28 ? Order.Guard : decision < .56 ? Order.Skill : Order.Attack;
            }
            a.clock = Math.Max(.95f, 2.2f - a.bug.Stat(a.species, 3) * .014f);
            if (a.order == Order.Guard) return;
            bool heavy = a.order == Order.Skill;
            float cost = heavy ? 33 : 13;
            if (a.energy < cost) { a.clock = .6f; Say(a.bug.Name(a.species) + "は息を整えている"); return; }
            a.energy -= cost;
            bool guarded = b.order == Order.Guard && !b.IsDown;
            float damage = (a.bug.Stat(a.species, 1) * (heavy ? 1.8f : 1) - b.bug.Stat(b.species, 2) * .32f)
                * Advantage(a.species.type, b.species.type) * (.9f + (float)random.NextDouble() * .2f);
            damage = Math.Max(3, damage) * (guarded ? .3f : b.IsDown ? 1.35f : 1);
            b.hp = Math.Max(0, b.hp - damage); b.flash = .35f; a.hits++;
            b.balance = Math.Max(0, b.balance - (heavy ? 32 : 17) * (guarded ? .2f : 1));
            Say(a.bug.Name(a.species) + (heavy ? "：" + a.species.skill : "の攻撃") + (guarded ? " / ガード" : b.IsDown ? " / ダウン追撃" : ""));
            impact?.Invoke(side, heavy);
            if (b.hp <= 0) { ended = true; return; }
            if (!b.IsDown && b.immunity <= 0 && random.NextDouble() < FallChance(b.balance, b.energy, heavy, guarded))
                Fall(b);
            // Heavy attacks can overbalance their user, but never while protected after recovery.
            if (heavy && a.immunity <= 0 && random.NextDouble() < .02f + (100 - a.energy) * .0009f) Fall(a);
        }
        void Fall(Fighter f)
        {
            f.down = 3.4f + (float)random.NextDouble() * 1.2f;
            f.falls++; f.clock = .5f;
            Say(f.bug.Name(f.species) + "が転倒！");
        }
        void Say(string text) { message = text; eventId++; }
    }
}
