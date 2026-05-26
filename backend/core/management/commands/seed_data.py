"""
seed_data.py — Populates the database with all 10 IPL teams and a realistic player pool.
Run with: python manage.py seed_data
"""
from django.core.management.base import BaseCommand
from core.models import Team, Player


IPL_TEAMS = [
    {'name': 'Chennai Super Kings',    'shortName': 'CSK',  'primaryColor': '#F9C000'},
    {'name': 'Mumbai Indians',         'shortName': 'MI',   'primaryColor': '#005DA0'},
    {'name': 'Royal Challengers Bengaluru', 'shortName': 'RCB', 'primaryColor': '#C8102E'},
    {'name': 'Kolkata Knight Riders',  'shortName': 'KKR',  'primaryColor': '#3A225D'},
    {'name': 'Rajasthan Royals',       'shortName': 'RR',   'primaryColor': '#EA1A8E'},
    {'name': 'Delhi Capitals',         'shortName': 'DC',   'primaryColor': '#17479E'},
    {'name': 'Punjab Kings',           'shortName': 'PBKS', 'primaryColor': '#ED1B24'},
    {'name': 'Sunrisers Hyderabad',    'shortName': 'SRH',  'primaryColor': '#F7A721'},
    {'name': 'Lucknow Super Giants',   'shortName': 'LSG',  'primaryColor': '#A4C639'},
    {'name': 'Gujarat Titans',         'shortName': 'GT',   'primaryColor': '#1C2B59'},
]

PLAYERS = [
    # Batsmen (Indian)
    {'name': 'Virat Kohli',         'role': 'Batsman',      'basePrice': 200, 'nationality': 'Indian'},
    {'name': 'Rohit Sharma',        'role': 'Batsman',      'basePrice': 200, 'nationality': 'Indian'},
    {'name': 'Shubman Gill',        'role': 'Batsman',      'basePrice': 150, 'nationality': 'Indian'},
    {'name': 'KL Rahul',            'role': 'Batsman',      'basePrice': 150, 'nationality': 'Indian'},
    {'name': 'Yashasvi Jaiswal',    'role': 'Batsman',      'basePrice': 100, 'nationality': 'Indian'},
    {'name': 'Ruturaj Gaikwad',     'role': 'Batsman',      'basePrice': 100, 'nationality': 'Indian'},
    {'name': 'Devdutt Padikkal',    'role': 'Batsman',      'basePrice': 50,  'nationality': 'Indian'},
    {'name': 'Abhishek Sharma',     'role': 'Batsman',      'basePrice': 50,  'nationality': 'Indian'},
    {'name': 'Priyank Panchal',     'role': 'Batsman',      'basePrice': 20,  'nationality': 'Indian'},
    {'name': 'N Jagadeesan',        'role': 'Batsman',      'basePrice': 20,  'nationality': 'Indian'},
    # Batsmen (Overseas)
    {'name': 'David Warner',        'role': 'Batsman',      'basePrice': 150, 'nationality': 'Overseas'},
    {'name': 'Jos Buttler',         'role': 'Batsman',      'basePrice': 150, 'nationality': 'Overseas'},
    {'name': 'Faf du Plessis',      'role': 'Batsman',      'basePrice': 100, 'nationality': 'Overseas'},
    {'name': 'Glenn Phillips',      'role': 'Batsman',      'basePrice': 75,  'nationality': 'Overseas'},
    {'name': 'Will Jacks',          'role': 'Batsman',      'basePrice': 50,  'nationality': 'Overseas'},
    {'name': 'Phil Salt',           'role': 'Batsman',      'basePrice': 50,  'nationality': 'Overseas'},
    # Wicketkeepers (Indian)
    {'name': 'MS Dhoni',            'role': 'Wicketkeeper', 'basePrice': 200, 'nationality': 'Indian'},
    {'name': 'Sanju Samson',        'role': 'Wicketkeeper', 'basePrice': 100, 'nationality': 'Indian'},
    {'name': 'Ishan Kishan',        'role': 'Wicketkeeper', 'basePrice': 75,  'nationality': 'Indian'},
    {'name': 'Rishabh Pant',        'role': 'Wicketkeeper', 'basePrice': 200, 'nationality': 'Indian'},
    {'name': 'Dhruv Jurel',         'role': 'Wicketkeeper', 'basePrice': 40,  'nationality': 'Indian'},
    # Wicketkeepers (Overseas)
    {'name': 'Heinrich Klaasen',    'role': 'Wicketkeeper', 'basePrice': 100, 'nationality': 'Overseas'},
    {'name': 'Nicholas Pooran',     'role': 'Wicketkeeper', 'basePrice': 75,  'nationality': 'Overseas'},
    # All-Rounders (Indian)
    {'name': 'Hardik Pandya',       'role': 'All-Rounder',  'basePrice': 200, 'nationality': 'Indian'},
    {'name': 'Ravindra Jadeja',     'role': 'All-Rounder',  'basePrice': 175, 'nationality': 'Indian'},
    {'name': 'Ravichandran Ashwin', 'role': 'All-Rounder',  'basePrice': 100, 'nationality': 'Indian'},
    {'name': 'Washington Sundar',   'role': 'All-Rounder',  'basePrice': 75,  'nationality': 'Indian'},
    {'name': 'Axar Patel',          'role': 'All-Rounder',  'basePrice': 75,  'nationality': 'Indian'},
    {'name': 'Shivam Dube',         'role': 'All-Rounder',  'basePrice': 60,  'nationality': 'Indian'},
    {'name': 'Venkatesh Iyer',      'role': 'All-Rounder',  'basePrice': 50,  'nationality': 'Indian'},
    {'name': 'Nitish Kumar Reddy',  'role': 'All-Rounder',  'basePrice': 40,  'nationality': 'Indian'},
    # All-Rounders (Overseas)
    {'name': 'Ben Stokes',          'role': 'All-Rounder',  'basePrice': 150, 'nationality': 'Overseas'},
    {'name': 'Andre Russell',       'role': 'All-Rounder',  'basePrice': 150, 'nationality': 'Overseas'},
    {'name': 'Marcus Stoinis',      'role': 'All-Rounder',  'basePrice': 100, 'nationality': 'Overseas'},
    {'name': 'Sunil Narine',        'role': 'All-Rounder',  'basePrice': 100, 'nationality': 'Overseas'},
    {'name': 'Glenn Maxwell',       'role': 'All-Rounder',  'basePrice': 100, 'nationality': 'Overseas'},
    {'name': 'Mitchell Marsh',      'role': 'All-Rounder',  'basePrice': 75,  'nationality': 'Overseas'},
    {'name': 'Liam Livingstone',    'role': 'All-Rounder',  'basePrice': 75,  'nationality': 'Overseas'},
    {'name': 'David Miller',        'role': 'All-Rounder',  'basePrice': 75,  'nationality': 'Overseas'},
    # Bowlers (Indian)
    {'name': 'Jasprit Bumrah',      'role': 'Bowler',       'basePrice': 200, 'nationality': 'Indian'},
    {'name': 'Mohammed Shami',      'role': 'Bowler',       'basePrice': 200, 'nationality': 'Indian'},
    {'name': 'Yuzvendra Chahal',    'role': 'Bowler',       'basePrice': 100, 'nationality': 'Indian'},
    {'name': 'Arshdeep Singh',      'role': 'Bowler',       'basePrice': 100, 'nationality': 'Indian'},
    {'name': 'Mohammed Siraj',      'role': 'Bowler',       'basePrice': 75,  'nationality': 'Indian'},
    {'name': 'Kuldeep Yadav',       'role': 'Bowler',       'basePrice': 75,  'nationality': 'Indian'},
    {'name': 'T Natarajan',         'role': 'Bowler',       'basePrice': 50,  'nationality': 'Indian'},
    {'name': 'Avesh Khan',          'role': 'Bowler',       'basePrice': 40,  'nationality': 'Indian'},
    {'name': 'Varun Chakaravarthy', 'role': 'Bowler',       'basePrice': 50,  'nationality': 'Indian'},
    {'name': 'Deepak Chahar',       'role': 'Bowler',       'basePrice': 50,  'nationality': 'Indian'},
    {'name': 'Shardul Thakur',      'role': 'Bowler',       'basePrice': 40,  'nationality': 'Indian'},
    {'name': 'Akash Deep',          'role': 'Bowler',       'basePrice': 30,  'nationality': 'Indian'},
    {'name': 'Tushar Deshpande',    'role': 'Bowler',       'basePrice': 20,  'nationality': 'Indian'},
    {'name': 'Harshit Rana',        'role': 'Bowler',       'basePrice': 20,  'nationality': 'Indian'},
    # Bowlers (Overseas)
    {'name': 'Jofra Archer',        'role': 'Bowler',       'basePrice': 150, 'nationality': 'Overseas'},
    {'name': 'Pat Cummins',         'role': 'Bowler',       'basePrice': 200, 'nationality': 'Overseas'},
    {'name': 'Kagiso Rabada',       'role': 'Bowler',       'basePrice': 150, 'nationality': 'Overseas'},
    {'name': 'Trent Boult',         'role': 'Bowler',       'basePrice': 100, 'nationality': 'Overseas'},
    {'name': 'Rashid Khan',         'role': 'Bowler',       'basePrice': 200, 'nationality': 'Overseas'},
    {'name': 'Mitchell Starc',      'role': 'Bowler',       'basePrice': 150, 'nationality': 'Overseas'},
    {'name': 'Josh Hazlewood',      'role': 'Bowler',       'basePrice': 100, 'nationality': 'Overseas'},
    {'name': 'Alzarri Joseph',      'role': 'Bowler',       'basePrice': 75,  'nationality': 'Overseas'},
    {'name': 'Lockie Ferguson',     'role': 'Bowler',       'basePrice': 50,  'nationality': 'Overseas'},
    {'name': 'Noor Ahmad',          'role': 'Bowler',       'basePrice': 50,  'nationality': 'Overseas'},
]


class Command(BaseCommand):
    help = 'Seeds the database with 10 IPL teams and 60 players'

    def handle(self, *args, **options):
        # Teams
        team_count = 0
        for t in IPL_TEAMS:
            _, created = Team.objects.update_or_create(
                shortName=t['shortName'],
                defaults={'name': t['name'], 'primaryColor': t['primaryColor']},
            )
            if created:
                team_count += 1
        self.stdout.write(self.style.SUCCESS(f'OK  {team_count} new teams created (total {Team.objects.count()})'))

        # Players
        player_count = 0
        for p in PLAYERS:
            _, created = Player.objects.get_or_create(
                name=p['name'],
                defaults={'role': p['role'], 'basePrice': p['basePrice'], 'nationality': p['nationality']},
            )
            if created:
                player_count += 1
        self.stdout.write(self.style.SUCCESS(f'OK  {player_count} new players created (total {Player.objects.count()})'))
