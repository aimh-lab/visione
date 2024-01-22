package it.cnr.isti.visione.services;

import java.util.Map;

public class FieldParameters {

	private String field;
	private float weight;
	private String similarity;

	public static FieldParameters fromMap(Map<String, Object> map) {
		String field = (String) map.get("field");
		float weight = (float) map.get("weight");
		String similarity = (String) map.get("similarity");
		return new FieldParameters(field, weight, similarity);
	}

	public FieldParameters(String field, float weight, String similarity) {
		this.field = field;
		this.weight = weight;
		this.similarity = similarity;
	}

	public String getField() {
		return field;
	}

	public void setField(String field) {
		this.field = field;
	}

	public float getWeight() {
		return weight;
	}

	public void setWeight(float weight) {
		this.weight = weight;
	}

	public String getSimilarity() {
		return similarity;
	}

	public void setSimilarity(String similarity) {
		this.similarity = similarity;
	}

}
