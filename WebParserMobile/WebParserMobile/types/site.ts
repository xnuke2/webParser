export interface Site {
    Id: number;
    Url: string;
    Name: string;
    CreatedAt?: string;
    UpdatedAt?: string;
}

export interface SiteField {
    Field: string;
    Data: string;
}