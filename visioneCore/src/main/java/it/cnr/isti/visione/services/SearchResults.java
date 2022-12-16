package it.cnr.isti.visione.services;


public class SearchResults  {
	
	public float score;
	public String videoId;
	public String imgId;
	public int middleFrame;

	public String collection;
	
	public SearchResults(String imgId, String videoId, String collection, float score, int middleFrame) {
		this.videoId = videoId;
		this.imgId = imgId;
		this.middleFrame = middleFrame;
		this.collection = collection;
		this.score = score;
	}
}
