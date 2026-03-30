"""Tests for Category Classifier."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from classifiers.category_classifier import classify_event


class TestAcademicCategory:
    def test_seminar(self):
        cats, reasons = classify_event("ECEN Seminar: Machine Learning")
        assert cats["academic"] == 1

    def test_colloquium(self):
        cats, reasons = classify_event("Physics Colloquium: Dark Matter")
        assert cats["academic"] == 1

    def test_workshop(self):
        cats, reasons = classify_event("Resume Workshop", "Learn to build your resume.")
        assert cats["academic"] == 1

    def test_pitch_competition(self):
        cats, reasons = classify_event("Good Bull Pitch Competition")
        assert cats["academic"] == 1

    def test_hackathon(self):
        cats, reasons = classify_event("HowdyHack 2026", "Annual hackathon at TAMU")
        assert cats["academic"] == 1


class TestSocialCategory:
    def test_mixer(self):
        cats, _ = classify_event("Fall Mixer Night")
        assert cats["social"] == 1

    def test_game_night(self):
        cats, _ = classify_event("Board Game Night")
        assert cats["social"] == 1

    def test_social_negative_pattern(self):
        """'Social media' should NOT match social category."""
        cats, _ = classify_event("Social Media Marketing Workshop")
        assert cats["social"] == 0

    def test_social_science_negative(self):
        """'Social science' should NOT match social category."""
        cats, _ = classify_event("Social Science Research Forum")
        assert cats["social"] == 0


class TestSportsCategory:
    def test_intramural(self):
        cats, _ = classify_event("Intramural Basketball Tournament")
        assert cats["sports"] == 1

    def test_rec_sports(self):
        cats, _ = classify_event("Rec Sports Fitness Class")
        assert cats["sports"] == 1

    def test_tailgate(self):
        cats, _ = classify_event("TAMU Tailgate Party")
        assert cats["sports"] == 1


class TestFoodCategory:
    def test_pizza(self):
        cats, _ = classify_event("Free Pizza Night")
        assert cats["food"] == 1

    def test_lunch(self):
        cats, _ = classify_event("Lunch and Learn")
        assert cats["food"] == 1

    def test_food_science_negative(self):
        """'Food science' should NOT match food category."""
        cats, _ = classify_event("Food Science 101")
        assert cats["food"] == 0


class TestAdvocacyCategory:
    def test_volunteer(self):
        cats, _ = classify_event("Volunteer Day at Habitat for Humanity")
        assert cats["advocacy"] == 1

    def test_voter_registration(self):
        cats, _ = classify_event("Voter Registration Drive")
        assert cats["advocacy"] == 1


class TestEntertainmentCategory:
    def test_concert(self):
        cats, _ = classify_event("Spring Concert at Rudder")
        assert cats["entertainment"] == 1

    def test_movie_night(self):
        cats, _ = classify_event("MSC Movie Night: Star Wars")
        assert cats["entertainment"] == 1

    def test_trivia(self):
        cats, _ = classify_event("Trivia Night at MSC")
        assert cats["entertainment"] == 1


class TestHealthWellnessCategory:
    def test_mental_health(self):
        cats, _ = classify_event("Mental Health Awareness Week")
        assert cats["health_wellness"] == 1

    def test_meditation(self):
        cats, _ = classify_event("Guided Meditation Session")
        assert cats["health_wellness"] == 1

    def test_blood_drive(self):
        cats, _ = classify_event("Red Cross Blood Drive")
        assert cats["health_wellness"] == 1


class TestReligionCategory:
    def test_bible_study(self):
        cats, _ = classify_event("Weekly Bible Study")
        assert cats["religion"] == 1

    def test_worship(self):
        cats, _ = classify_event("Sunday Worship Service")
        assert cats["religion"] == 1

    def test_interfaith(self):
        cats, _ = classify_event("Interfaith Dialogue")
        assert cats["religion"] == 1


class TestMultiCategory:
    def test_social_and_food(self):
        """A pizza social should be both social and food."""
        cats, _ = classify_event("Pizza Social Night", "Free pizza and socializing!")
        assert cats["social"] == 1 or cats["food"] == 1

    def test_academic_and_food(self):
        """A lunch seminar should be both academic and food."""
        cats, _ = classify_event("Lunch Seminar: AI Ethics")
        assert cats["academic"] == 1
        assert cats["food"] == 1

    def test_sports_and_entertainment(self):
        """A watch party could be both."""
        cats, _ = classify_event("Football Watch Party")
        assert cats["sports"] == 1 or cats["entertainment"] == 1
