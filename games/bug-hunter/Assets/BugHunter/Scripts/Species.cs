using System;
using UnityEngine;

namespace BugHunter
{
    public enum BugType { Power, Guard, Speed }
    public enum Order { Attack, Guard, Skill }

    [CreateAssetMenu(menuName = "Bug Hunter/Species")]
    public sealed class Species : ScriptableObject
    {
        public int id;
        public string displayName;
        public string habitat;
        public string skill;
        public BugType type;
        public Color shell;
        public int health = 100, attack = 18, defense = 12, speed = 12;
        public int[] growth = { 6, 2, 2, 2 };
        public float capture = .65f;
        public GameObject model;

        public static string TypeName(BugType type) => new[] { "パワー", "ガード", "スピード" }[(int)type];
    }

    [Serializable]
    public sealed class Individual
    {
        public string id;
        public int species, seed, level = 1, xp, training;
        public int[] aptitude = new int[4];
        public int[] growth = new int[4];
        public string nickname = "";
        public int nature;
        public float size;

        public string Name(Species data) => string.IsNullOrWhiteSpace(nickname) ? data.displayName : nickname;
        public string Nature => new[] { "いさましい", "ねばり強い", "慎重", "すばしこい" }[nature];
        public int Stat(Species data, int index)
        {
            int basis = index == 0 ? data.health : index == 1 ? data.attack : index == 2 ? data.defense : data.speed;
            return basis + aptitude[index] + (level - 1) * growth[index];
        }
        public static Individual Create(Species data, int seed)
        {
            var random = new System.Random(seed);
            var item = new Individual { id = Guid.NewGuid().ToString("N"), species = data.id, seed = seed,
                nature = random.Next(4), size = .88f + (float)random.NextDouble() * .24f };
            for (int i = 0; i < 4; i++)
            {
                item.aptitude[i] = random.Next(i == 0 ? 17 : 7);
                item.growth[i] = data.growth[i] + random.Next(0, 3) + (item.nature == i ? 1 : 0);
            }
            return item;
        }
        public int NextXp => 24 + level * 12;
        public int Gain(int amount)
        {
            int old = level;
            if (level >= 20) return 0;
            xp += Math.Max(0, amount);
            while (level < 20 && xp >= NextXp) { xp -= NextXp; level++; }
            if (level == 20) xp = 0;
            return level - old;
        }
    }

    [Serializable]
    public sealed class SaveData
    {
        public int version = 1, nectar = 20, captures, wins, trophies;
        public string partner;
        public System.Collections.Generic.List<Individual> bugs = new System.Collections.Generic.List<Individual>();
        public void Validate(Species[] catalog)
        {
            if (version != 1 || bugs == null || bugs.Count > 48) throw new ArgumentException("Invalid save format");
            var ids = new System.Collections.Generic.HashSet<string>();
            foreach (var bug in bugs)
            {
                if (bug == null || string.IsNullOrEmpty(bug.id) || !ids.Add(bug.id) || bug.species < 0 || bug.species >= catalog.Length
                    || bug.level < 1 || bug.level > 20 || bug.nature < 0 || bug.nature > 3
                    || bug.aptitude == null || bug.aptitude.Length != 4 || bug.growth == null || bug.growth.Length != 4)
                    throw new ArgumentException("Invalid individual");
                for (int i = 0; i < 4; i++)
                    if (bug.aptitude[i] < 0 || bug.aptitude[i] > 16 || bug.growth[i] < 1 || bug.growth[i] > 12)
                        throw new ArgumentException("Invalid growth data");
                bug.size = Mathf.Clamp(bug.size, .88f, 1.12f);
                bug.xp = Mathf.Clamp(bug.xp, 0, bug.NextXp - 1);
            }
            nectar = Mathf.Clamp(nectar, 0, 9999);
            captures = Math.Max(0, captures); wins = Math.Max(0, wins); trophies = Math.Max(0, trophies);
            if (!bugs.Exists(b => b.id == partner)) partner = bugs.Count > 0 ? bugs[0].id : null;
        }
    }
}
