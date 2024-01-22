package it.cnr.isti.visione.services;

public class FeatureExtractorResponse {

	private String featureID;

	private float[] features;

	private String queryURL;

	public FeatureExtractorResponse(String featureID, float[] features, String queryURL) {
		this.featureID = featureID;
		this.features = features;
		this.queryURL = queryURL;
	}

	public String getFeatureID() {
		return featureID;
	}

	public void setFeatureID(String featureID) {
		this.featureID = featureID;
	}

	public float[] getFeatures() {
		return features;
	}

	public void setFeatures(float[] features) {
		this.features = features;
	}

	public String getQueryURL() {
		return queryURL;
	}

	public void setQueryURL(String queryURL) {
		this.queryURL = queryURL;
	}

}
