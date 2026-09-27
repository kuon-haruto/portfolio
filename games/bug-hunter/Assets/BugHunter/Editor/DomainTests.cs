using System;
using BugHunter;
using UnityEngine;

public static class DomainTests
{
    static int count;
    static void Check(bool condition,string name){if(!condition)throw new Exception("TEST FAILED: "+name);count++;}
    public static void Run(Species[] catalog)
    {
        count=0;var s=catalog[0];var a=Individual.Create(s,123);var b=Individual.Create(s,124);var clone=Individual.Create(s,123);
        Check(a.id!=clone.id,"individual ids unique");Check(a.Stat(s,0)==clone.Stat(s,0),"seeded phenotype");
        bool varied=false;for(int i=0;i<4;i++)varied|=a.aptitude[i]!=b.aptitude[i]||a.growth[i]!=b.growth[i];Check(varied,"same species varies");
        int hp=a.Stat(s,0);a.Gain(a.NextXp);Check(a.level==2&&a.Stat(s,0)==hp+a.growth[0],"growth follows aptitude");
        a.Gain(int.MaxValue/2);Check(a.level==20&&a.xp==0,"level capped");
        Check(Battle.Advantage(BugType.Power,BugType.Guard)>1,"type advantage");Check(Battle.Advantage(BugType.Guard,BugType.Power)<1,"type disadvantage");
        Check(Battle.FallChance(0,0,true,false)<=.34f,"fall chance cap");
        Check(Battle.FallChance(0,0,true,true)<Battle.FallChance(0,0,true,false),"guard stabilizes");
        Check(Battle.FallChance(30,20,true,false)>Battle.FallChance(100,100,false,false),"fatigue affects luck");
        var match=new Battle(Individual.Create(s,1),s,Individual.Create(s,2),s,10);
        match.player.down=4;match.player.order=Order.Guard;match.enemy.clock=100;
        Check(!match.Command(Order.Skill),"cannot command while down");
        for(int i=0;i<120;i++)match.Tick(1f/60);Check(match.player.IsDown,"recovery takes time");
        for(int i=0;i<160;i++)match.Tick(1f/60);Check(!match.player.IsDown&&match.player.immunity>0,"recovery grace period");
        var guarded=new Battle(Individual.Create(s,1),s,Individual.Create(s,2),s,44);
        var downed=new Battle(Individual.Create(s,1),s,Individual.Create(s,2),s,44);
        guarded.enemy.order=Order.Guard;downed.enemy.order=Order.Guard;downed.enemy.down=4;
        guarded.player.clock=downed.player.clock=0;guarded.enemy.clock=downed.enemy.clock=10;
        guarded.Tick(.05f);downed.Tick(.05f);Check(downed.enemy.hp<guarded.enemy.hp,"down ignores guard");Check(downed.enemy.down<=4,"hits never extend down timer");
        var tired=new Battle(Individual.Create(s,1),s,Individual.Create(s,2),s,44);
        tired.player.energy=0;tired.player.order=Order.Skill;tired.player.clock=0;tired.Tick(.05f);
        Check(tired.player.order==Order.Skill,"fatigue preserves requested order");
        Check(tired.player.hits==0,"no attack without stamina");
        int wins=0,falls=0;
        for(int seed=0;seed<120;seed++)
        {
            var battle=new Battle(Individual.Create(catalog[seed%6],seed),catalog[seed%6],Individual.Create(catalog[(seed+1)%6],seed+1),catalog[(seed+1)%6],seed);
            for(int tick=0;tick<10000&&!battle.ended;tick++)
            {
                if(tick%120==0)battle.Command(battle.player.energy<30||battle.player.balance<30?Order.Guard:tick%240==0?Order.Skill:Order.Attack);
                battle.Tick(1f/60);
            }
            Check(battle.ended,"battle terminates "+seed);Check(battle.player.hp>=0&&battle.enemy.hp>=0,"health bounded "+seed);
            if(battle.Victory)wins++;falls+=battle.player.falls+battle.enemy.falls;
        }
        Check(wins>12&&wins<108,"neither guaranteed win nor loss");Check(falls>0,"luck events occur");
        var save=new SaveData();save.bugs.Add(b);save.partner=b.id;save.Validate(catalog);
        var loaded=JsonUtility.FromJson<SaveData>(JsonUtility.ToJson(save));loaded.Validate(catalog);
        Check(loaded.bugs[0].id==b.id&&loaded.bugs[0].growth[0]==b.growth[0],"save round trip");
        loaded.bugs[0].species=999;bool rejected=false;try{loaded.Validate(catalog);}catch(ArgumentException){rejected=true;}Check(rejected,"corrupt save rejected");
        Debug.Log("BUG_HUNTER_TESTS_OK assertions="+count+" simulationWins="+wins+"/120 falls="+falls);
    }
}
