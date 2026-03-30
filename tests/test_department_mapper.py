"""Tests for Department Mapper."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from mappers.department_mapper import map_department


class TestSourceNameMapping:
    """Test direct source_name → department mappings."""

    def test_engineering_source(self):
        code, name, ht = map_department(source_name="engineering")
        assert code == "ENGR"
        assert "Engineering" in name

    def test_business_source(self):
        code, name, ht = map_department(source_name="business")
        assert code == "BUSN"
        assert "Mays" in name

    def test_mcferrin_events_source(self):
        code, name, ht = map_department(source_name="mcferrin_events")
        assert code == "MCFR"
        assert "McFerrin" in name

    def test_career_center_source(self):
        code, name, ht = map_department(source_name="career_center")
        assert code == "CAREER"
        assert "Career" in name

    def test_msc_source(self):
        code, name, ht = map_department(source_name="msc")
        assert code == "MSC"
        assert "Memorial Student Center" in name

    def test_rec_sports_source(self):
        code, name, ht = map_department(source_name="rec_sports")
        assert code == "RECSPORTS"

    def test_diversity_source(self):
        code, name, ht = map_department(source_name="diversity")
        assert code == "DIV"


class TestHostNameMapping:
    """Test host_name → department mappings."""

    def test_ecen_host(self):
        code, name, ht = map_department(host_name="ECEN Department")
        assert code == "ECEN"

    def test_computer_science_host(self):
        code, name, ht = map_department(host_name="Computer Science & Engineering")
        assert code == "CSCE"

    def test_mays_business_host(self):
        code, name, ht = map_department(host_name="Mays Business School")
        assert code == "BUSN"

    def test_mcferrin_center_host(self):
        code, name, ht = map_department(host_name="McFerrin Center for Entrepreneurship")
        assert code == "MCFR"


class TestTitleMapping:
    """Test title/description → department mappings."""

    def test_mcferrin_in_title(self):
        code, name, ht = map_department(title="McFerrin Mashup: Startup Night")
        assert code == "MCFR"

    def test_engineering_in_description(self):
        code, name, ht = map_department(
            title="Spring Seminar",
            description="Hosted by the College of Engineering"
        )
        assert code is not None


class TestHostTypeInference:
    """Test host_type inference from department mapping."""

    def test_college_type(self):
        _, _, ht = map_department(source_name="engineering")
        assert ht == "college"

    def test_center_type(self):
        _, _, ht = map_department(source_name="mcferrin_events")
        assert ht == "center"

    def test_student_org_type(self):
        _, _, ht = map_department(source_name="getinvolved_events")
        assert ht == "student_org"

    def test_department_type(self):
        _, _, ht = map_department(source_name="rec_sports")
        assert ht == "department"


class TestUnknownMapping:
    """Test that unknown inputs return None."""

    def test_unknown_source(self):
        code, name, ht = map_department(source_name="random_xyz_source")
        assert code is None
        assert name is None

    def test_empty_inputs(self):
        code, name, ht = map_department()
        assert code is None
        assert name is None

    def test_unrelated_host(self):
        code, name, ht = map_department(host_name="Random Community Group")
        assert code is None
