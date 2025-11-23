import xml.etree.ElementTree as ET
from typing import Any, Dict
from flask import Request, Response


def parse_xml_request(request: Request) -> Dict[str, Any]:
    try:
        xml_data = request.data.decode("utf-8")
        root = ET.fromstring(xml_data)
        data: Dict[str, Any] = {}
        for child in root:
            if child.tag == "patient":
                data["patient"] = {item.tag: item.text for item in child}
            elif child.tag == "studies":
                data["studies"] = [study.text for study in child.findall("study")]
            else:
                data[child.tag] = child.text
        return data
    except Exception:
        return {}


def create_xml_response(data: Dict[str, Any]) -> Response:
    root = ET.Element("response")
    for key, value in data.items():
        elem = ET.SubElement(root, key)
        elem.text = "" if value is None else str(value)
    xml_str = ET.tostring(root, encoding="unicode")
    return Response(xml_str, mimetype="application/xml")


def is_mobile_client(request: Request) -> bool:
    user_agent = (request.headers.get("User-Agent") or "").lower()
    return any(token in user_agent for token in ("mobile", "android", "ios"))
